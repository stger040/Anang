import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="pay/[token]"
          options={{
            title: "Make a Payment",
            headerStyle: { backgroundColor: colors.navy },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
        <Stack.Screen
          name="pay/plan"
          options={{
            title: "Payment Plan",
            headerStyle: { backgroundColor: colors.navy },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
        <Stack.Screen
          name="pay/success"
          options={{
            title: "Payment Confirmed",
            headerStyle: { backgroundColor: colors.navy },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: "600" },
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ask-ai"
          options={{
            title: "Ask AI",
            headerStyle: { backgroundColor: colors.navy },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
