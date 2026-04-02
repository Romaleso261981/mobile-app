import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
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
    <Tab.Navigator
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
  );
}

