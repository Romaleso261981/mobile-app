import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/auth-context";
import { AppTabs } from "./src/navigation/app-tabs";
import { LoginScreen } from "./src/screens/login-screen";
import { RegisterScreen } from "./src/screens/register-screen";

export type RootStackParamList = {
  AuthLogin: undefined;
  AuthRegister: undefined;
  App: undefined;
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
        <Stack.Screen name="App" component={AppTabs} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="AuthLogin" component={LoginScreen} options={{ title: "Вхід" }} />
          <Stack.Screen name="AuthRegister" component={RegisterScreen} options={{ title: "Реєстрація" }} />
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
