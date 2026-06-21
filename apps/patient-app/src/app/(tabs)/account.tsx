import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { clearSession } from "@/lib/api";
import { Card } from "@/components/Card";
import { colors, spacing, typography, radius } from "@/lib/theme";

const MENU_ITEMS = [
  { icon: "notifications-outline" as const, label: "Notification preferences" },
  { icon: "document-text-outline" as const, label: "Statement history" },
  { icon: "lock-closed-outline" as const, label: "Privacy & security" },
  { icon: "call-outline" as const, label: "Contact billing" },
  { icon: "help-circle-outline" as const, label: "Help & FAQ" },
];

export default function AccountTab() {
  async function handleSignOut() {
    Alert.alert("Sign out", "This will remove your session from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          router.replace("/");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* Profile placeholder */}
      <Card variant="navy" style={{ marginBottom: spacing.lg, alignItems: "center" }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.full,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.sm,
          }}
        >
          <Ionicons name="person" size={28} color={colors.white} />
        </View>
        <Text style={{ ...typography.heading3, color: colors.white }}>Patient Portal</Text>
        <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          Riverside Health System
        </Text>
      </Card>

      {MENU_ITEMS.map((item) => (
        <TouchableOpacity key={item.label} activeOpacity={0.85}>
          <Card style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: colors.sky,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon} size={18} color={colors.navy} />
            </View>
            <Text style={{ ...typography.body, color: colors.ink, flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Card>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={handleSignOut}
        style={{
          marginTop: spacing.md,
          borderRadius: radius.md,
          paddingVertical: 14,
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: colors.error,
        }}
        activeOpacity={0.85}
      >
        <Text style={{ ...typography.body, fontWeight: "600", color: colors.error }}>
          Sign out
        </Text>
      </TouchableOpacity>

      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", marginTop: spacing.lg }}>
        Anang Patient · v1.0.0{"\n"}
        HIPAA-compliant · Your data is never sold
      </Text>
    </ScrollView>
  );
}
