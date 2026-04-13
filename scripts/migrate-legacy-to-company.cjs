#!/usr/bin/env node
/**
 * Одноразова міграція «старого» проєкту без companyId → одна компанія, дані залишаються.
 *
 * Потрібно: сервісний акаунт Firebase (Ролі: хоча б «Firebase Admin SDK Administrator Service Agent»
 * або власний ключ з правами на Firestore + Auth).
 *
 * 1) Завантажте JSON ключа: Firebase Console → Project settings → Service accounts → Generate new private key
 * 2) У терміналі (з кореня репозиторію):
 *
 *    npm install
 *    export GOOGLE_APPLICATION_CREDENTIALS="/повний/шлях/до/serviceAccount.json"
 *    npm run migrate:legacy-company -- --admin-email="ваш@email.com" --company-name="Назва фірми"
 *
 * Скрипт:
 * - створює companies/{id}, companyJoinCodes/{код}
 * - робить вказаного користувача адміном цієї компанії (users/{uid})
 * - додає той самий companyId до всіх документів у workEntries, salaryPayouts, categories,
 *   у яких ще немає companyId
 * - за замовчуванням проставляє той самий companyId усім users/* без companyId (роль не змінює)
 *
 * Опції:
 *   --admin-email=   (обов'язково) email облікового запису Firebase Auth
 *   --company-name=  (обов'язково) назва організації
 *   --skip-other-users   не оновлювати інші профілі users (лише admin-email + дані)
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
    else if (a === "--skip-other-users") out.skipOtherUsers = true;
  }
  return out;
}

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function ensureUniqueJoinCode(db) {
  for (let i = 0; i < 32; i++) {
    const code = generateJoinCode();
    const snap = await db.collection("companyJoinCodes").doc(code).get();
    if (!snap.exists) return code;
  }
  throw new Error("Не вдалося згенерувати унікальний код");
}

async function commitBatches(db, updates) {
  const chunk = 450;
  for (let i = 0; i < updates.length; i += chunk) {
    const batch = db.batch();
    for (const { ref, data } of updates.slice(i, i + chunk)) {
      batch.update(ref, data);
    }
    await batch.commit();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const adminEmail = args["admin-email"];
  const companyName = args["company-name"];
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credPath || !fs.existsSync(credPath)) {
    console.error("Вкажіть існуючий файл ключа: export GOOGLE_APPLICATION_CREDENTIALS=/path/to.json");
    process.exit(1);
  }
  if (!adminEmail || !companyName) {
    console.error('Потрібні: --admin-email="..." --company-name="..."');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(credPath), "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(adminEmail.trim());
  } catch (e) {
    console.error("Користувача з таким email у Firebase Auth не знайдено:", e.message);
    process.exit(1);
  }

  const uid = userRecord.uid;
  const joinCode = await ensureUniqueJoinCode(db);
  const companyRef = db.collection("companies").doc();
  const companyId = companyRef.id;

  const batch0 = db.batch();
  batch0.set(companyRef, {
    name: companyName.trim(),
    joinCode,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByUid: uid,
  });
  batch0.set(db.collection("companyJoinCodes").doc(joinCode), { companyId });
  batch0.set(
    db.collection("users").doc(uid),
    {
      email: userRecord.email ?? adminEmail.trim(),
      companyId,
      companyName: companyName.trim(),
      role: "admin",
    },
    { merge: true },
  );
  await batch0.commit();
  console.log("Створено компанію:", companyId);
  console.log("Код для співробітників:", joinCode);

  const collections = ["workEntries", "salaryPayouts", "categories"];
  let totalPatched = 0;

  for (const col of collections) {
    const snap = await db.collection(col).get();
    const updates = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.companyId == null || d.companyId === undefined) {
        updates.push({ ref: doc.ref, data: { companyId } });
      }
    }
    if (updates.length) {
      await commitBatches(db, updates);
      totalPatched += updates.length;
      console.log(`${col}: оновлено документів без companyId: ${updates.length}`);
    } else {
      console.log(`${col}: немає документів без companyId`);
    }
  }

  if (!args.skipOtherUsers) {
    const usersSnap = await db.collection("users").get();
    const userUpdates = [];
    for (const doc of usersSnap.docs) {
      if (doc.id === uid) continue;
      const d = doc.data();
      if (d.companyId == null || d.companyId === undefined) {
        userUpdates.push({
          ref: doc.ref,
          data: {
            companyId,
            companyName: companyName.trim(),
          },
        });
      }
    }
    if (userUpdates.length) {
      await commitBatches(db, userUpdates);
      console.log(`users: проставлено companyId іншим профілям: ${userUpdates.length}`);
    } else {
      console.log("users: інші профілі без companyId не знайдені");
    }
  }

  console.log("Готово. Усього оновлень у колекціях даних (не users): перевірте лог вище.");
  console.log("Перезапустіть додаток і увійдіть знову.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
