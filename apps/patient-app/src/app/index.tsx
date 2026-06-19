import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { getStoredToken, getStoredOrg, storeSession } from "@/lib/api";
import { Button } from "@/components/Button";
import { colors, spacing, typography, radius } from "@/lib/theme";

export default function LandingScreen() {
  const [checking, setChecking] = useState(true);
  const [orgSlug, setOrgSlug] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored session or deep link token
    async function init() {
      const storedToken = await getStoredToken();
      const storedOrg = await getStoredOrg();
      if (storedToken && storedOrg) {
        router.replace("/(tabs)");
        return;
      }

      // Handle deep link: anang-patient://pay?org=riverside&token=abc
      const url = await Linking.getInitialURL();
      if (url) {
        const parsed = Linking.parse(url);
        const org = parsed.queryParams?.org as string | undefined;
        const tok = parsed.queryParams?.token as string | undefined;
        if (org && tok) {
          await storeSession(tok, org);
          router.replace("/(tabs)");
          return;
        }
      }

      setChecking(false);
    }
    init();
  }, []);

  async function handleContinue() {
    setError(null);
    if (!orgSlug.trim() || !token.trim()) {
      setError("Please enter your organization and the token from your bill.");
      return;
    }
    await storeSession(token.trim(), orgSlug.trim().toLowerCase());
    router.replace("/(tabs)");
  }

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.navy }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo area */}
        <View style={{ alignItems: "center", marginBottom: spacing["2xl"] }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.xl,
              backgroundColor: colors.coral,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: 28, color: colors.white, fontWeight: "700" }}>A</Text>
          </View>
          <Text style={{ ...typography.heading1, color: colors.white }}>Anang</Text>
          <Text style={{ ...typography.body, color: "rgba(255,255,255,0.65)", marginTop: 4, textAlign: "center" }}>
            Patient billing & financial assistance
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: radius.xl,
            padding: spacing.lg,
          }}
        >
          <Text style={{ ...typography.heading3, color: colors.white, marginBottom: spacing.sm }}>
            Access your bill
          </Text>
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)", marginBottom: spacing.lg }}>
            Open the secure link in your text or email, or enter your details below.
          </Text>

          <Text style={{ ...typography.label, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
            ORGANIZATION
          </Text>
          <TextInput
            value={orgSlug}
            onChangeText={setOrgSlug}
            placeholder="e.g. riverside-health"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.white,
              ...typography.body,
              marginBottom: spacing.md,
            }}
          />

          <Text style={{ ...typography.label, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
            ACCESS TOKEN (from your bill)
          </Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="Paste token from your bill link"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.white,
              ...typography.body,
              marginBottom: spacing.lg,
            }}
          />

          {error && (
            <Text style={{ ...typography.bodySmall, color: "#fca5a5", marginBottom: spacing.md }}>
              {error}
            </Text>
          )}

          <Button label="View my bill" onPress={handleContinue} />
        </View>

        <Text style={{ ...typography.caption, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: spacing.xl }}>
          Your data is protected under HIPAA. Anang never stores payment card details.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
