import React, { useEffect, useRef, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { WorksScreen } from "../screens/works-screen";
import { ExpensesScreen } from "../screens/expenses-screen";
import { AdminScreen } from "../screens/admin-screen";
import { useAuth } from "../auth/auth-context";
import { listSalaryPayoutsForViewer } from "../entities/payout/payout-service";
import { listWorkEntriesForViewer } from "../entities/work/work-service";
import { getRequestAuthUid } from "../lib/request-auth";
import { formatYearMonthUkrainian } from "../shared/date-filter";
import { EmployeeEntrySummaryModal, type EmployeeSummaryPayload } from "../components/employee-entry-summary-modal";

export type AppTabParamList = {
  Works: undefined;
  Expenses: undefined;
  Admin: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabs() {
  const { user } = useAuth();
  const [entrySummaryVisible, setEntrySummaryVisible] = useState(false);
  const [entrySummaryData, setEntrySummaryData] = useState<EmployeeSummaryPayload | null>(null);
  const entrySummaryDismissedRef = useRef(false);

  useEffect(() => {
    entrySummaryDismissedRef.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (user?.role !== "employee" || !user.uid || !user.companyId) {
      setEntrySummaryVisible(false);
      setEntrySummaryData(null);
      return;
    }
    if (entrySummaryDismissedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const uid = user.uid;
        const companyId = user.companyId;
        if (!companyId) return;
        const [works, payouts] = await Promise.all([
          listWorkEntriesForViewer({ uid, role: "employee", companyId }),
          listSalaryPayoutsForViewer({ uid, role: "employee", companyId }),
        ]);
        if (cancelled || getRequestAuthUid() !== uid) return;

        const d = new Date();
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const monthWorks = works.filter((w) => w.workDate.startsWith(ym));
        const monthPayouts = payouts.filter((p) => p.payoutDate.startsWith(ym));
        const monthEarned = monthWorks.reduce((s, w) => s + (w.amount ?? 0), 0);
        const monthPaid = monthPayouts.reduce((s, p) => s + (p.amount ?? 0), 0);
        const totalEarned = works.reduce((s, w) => s + (w.amount ?? 0), 0);
        const totalPaid = payouts.reduce((s, p) => s + (p.amount ?? 0), 0);

        setEntrySummaryData({
          monthTitle: formatYearMonthUkrainian(ym),
          monthEarned,
          monthPaid,
          monthBalance: monthEarned - monthPaid,
          totalEarned,
          totalPaid,
          totalBalance: totalEarned - totalPaid,
        });
        setEntrySummaryVisible(true);
      } catch {
        // не блокуємо вхід у застосунок
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.role]);

  function onEntrySummaryClose() {
    entrySummaryDismissedRef.current = true;
    setEntrySummaryVisible(false);
  }

  return (
    <>
      <EmployeeEntrySummaryModal visible={entrySummaryVisible} onClose={onEntrySummaryClose} data={entrySummaryData} />
    <Tab.Navigator
      key={user?.uid ?? "none"}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#3158f5",
        tabBarInactiveTintColor: "#7b8599",
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === "Works") {
            return <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={size} color={color} />;
          }
          if (route.name === "Expenses") {
            return <Ionicons name={focused ? "wallet" : "wallet-outline"} size={size} color={color} />;
          }
          return <Ionicons name={focused ? "shield-checkmark" : "shield-checkmark-outline"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Works" component={WorksScreen} options={{ title: "Роботи" }} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ title: "Витрати" }} />
      {user?.role === "admin" ? <Tab.Screen name="Admin" component={AdminScreen} options={{ title: "Адмін" }} /> : null}
    </Tab.Navigator>
    </>
  );
}

