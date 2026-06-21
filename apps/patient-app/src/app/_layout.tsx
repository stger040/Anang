import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StripeProvider } from "@stripe/stripe-react-native";
import { colors } from "@/lib/theme";
import { getStoredToken } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/push";

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    getStoredToken().then((token) => {
      if (token) {
        registerForPushNotifications();
      }
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier="merchant.ai.anang.patient">
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
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
