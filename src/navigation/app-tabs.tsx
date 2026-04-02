import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { WorksScreen } from "../screens/works-screen";
import { ExpensesScreen } from "../screens/expenses-screen";
import { AdminScreen } from "../screens/admin-screen";
import { useAuth } from "../auth/auth-context";

export type AppTabParamList = {
  Works: undefined;
  Expenses: undefined;
  Admin: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabs() {
  const { user } = useAuth();
  return (
    <Tab.Navigator screenOptions={{ headerTitleAlign: "center" }}>
      <Tab.Screen name="Works" component={WorksScreen} options={{ title: "Роботи" }} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ title: "Витрати" }} />
      {user?.role === "admin" ? <Tab.Screen name="Admin" component={AdminScreen} options={{ title: "Адмін" }} /> : null}
    </Tab.Navigator>
  );
}

