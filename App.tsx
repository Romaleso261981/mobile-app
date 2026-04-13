import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/auth-context";
import { AppTabs } from "./src/navigation/app-tabs";
import { LoginScreen } from "./src/screens/login-screen";
import { RegisterHubScreen } from "./src/screens/register-hub-screen";
import { RegisterCompanyScreen } from "./src/screens/register-company-screen";
import { RegisterJoinScreen } from "./src/screens/register-join-screen";
import { NoCompanyScreen } from "./src/screens/no-company-screen";

export type RootStackParamList = {
  AuthLogin: undefined;
  AuthRegisterHub: undefined;
  AuthRegisterCompany: undefined;
  AuthRegisterJoin: undefined;
  App: undefined;
  NoCompany: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
      {user ? (
        user.companyId ? (
          <Stack.Screen name="App" component={AppTabs} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="NoCompany" component={NoCompanyScreen} options={{ title: "Компанія" }} />
        )
      ) : (
        <>
          <Stack.Screen name="AuthLogin" component={LoginScreen} options={{ title: "Вхід" }} />
          <Stack.Screen name="AuthRegisterHub" component={RegisterHubScreen} options={{ title: "Реєстрація" }} />
          <Stack.Screen
            name="AuthRegisterCompany"
            component={RegisterCompanyScreen}
            options={{ title: "Нова компанія" }}
          />
          <Stack.Screen
            name="AuthRegisterJoin"
            component={RegisterJoinScreen}
            options={{ title: "Код компанії" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
