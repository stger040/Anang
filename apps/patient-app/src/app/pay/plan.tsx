import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { colors, spacing, typography, radius } from "@/lib/theme";

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const TOTAL_CENTS = 84700;
const MIN_CENTS = 1000;
const MAX_CENTS = TOTAL_CENTS;
const STEPS = [1000, 2000, 3500, 5000, 8470, 21175, 42350, 84700];

export default function PlanScreen() {
  const [frequency, setFrequency] = useState<"monthly" | "biweekly">("monthly");
  const [installmentCents, setInstallmentCents] = useState(8470);
  const [submitting, setSubmitting] = useState(false);

  const periods = frequency === "monthly" ? 1 : 0.5;
  const numPayments = Math.ceil(TOTAL_CENTS / installmentCents);
  const months = Math.ceil((numPayments * periods));
  const label = frequency === "monthly" ? "/month" : "/bi-weekly";

  async function handleConfirm() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    router.replace("/pay/success");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      <Card variant="navy" style={{ marginBottom: spacing.lg, alignItems: "center" }}>
        <Text style={{ ...typography.label, color: "rgba(255,255,255,0.6)" }}>TOTAL BALANCE</Text>
        <Text style={{ fontSize: 32, fontWeight: "800", color: colors.white, marginTop: 4 }}>
          {formatDollars(TOTAL_CENTS)}
        </Text>
      </Card>

      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.md }}>
        Customize your plan
      </Text>
      <Text style={{ ...typography.bodySmall, color: colors.muted, marginBottom: spacing.lg }}>
        Your scheduled plan can be edited or cancelled anytime.
      </Text>

      {/* Frequency toggle */}
      <Text style={{ ...typography.label, color: colors.muted, marginBottom: spacing.sm }}>
        FREQUENCY
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        {(["monthly", "biweekly"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFrequency(f)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.md,
              alignItems: "center",
              backgroundColor: frequency === f ? colors.navy : colors.white,
              borderWidth: 1.5,
              borderColor: frequency === f ? colors.navy : colors.border,
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                ...typography.body,
                fontWeight: "600",
                color: frequency === f ? colors.white : colors.muted,
              }}
            >
              {f === "monthly" ? "Monthly" : "Bi-weekly"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount display */}
      <Card style={{ marginBottom: spacing.lg, alignItems: "center" }}>
        <View
          style={{
            backgroundColor: colors.sky,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ ...typography.label, color: colors.navy }}>RECOMMENDED</Text>
        </View>
        <Text style={{ fontSize: 32, fontWeight: "800", color: colors.navy }}>
          {formatDollars(installmentCents)}{label}
        </Text>
        <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 4 }}>
          Length of plan · {numPayments} {frequency === "monthly" ? "monthly" : "bi-weekly"} payments
        </Text>
      </Card>

      {/* Amount selector */}
      <Text style={{ ...typography.label, color: colors.muted, marginBottom: spacing.sm }}>
        CHOOSE A {frequency === "monthly" ? "MONTHLY" : "BI-WEEKLY"} AMOUNT
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
        {STEPS.filter((s) => s <= MAX_CENTS).map((step) => (
          <TouchableOpacity
            key={step}
            onPress={() => setInstallmentCents(step)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.full,
              backgroundColor: installmentCents === step ? colors.navy : colors.white,
              borderWidth: 1.5,
              borderColor: installmentCents === step ? colors.navy : colors.border,
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                ...typography.bodySmall,
                fontWeight: "600",
                color: installmentCents === step ? colors.white : colors.muted,
              }}
            >
              {formatDollars(step)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ ...typography.caption, color: colors.muted }}>{formatDollars(MIN_CENTS)}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{formatDollars(MAX_CENTS)}</Text>
      </View>

      {/* Auto-pay notice */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          backgroundColor: colors.sky,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 16 }}>✓</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodySmall, fontWeight: "600", color: colors.navy }}>
            Auto-Pay available
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>
            Enable Auto-Pay after setting up your plan to never miss a payment.
            Invoices are automatically added as your care continues.
          </Text>
        </View>
      </View>

      <Button label="Confirm payment plan" onPress={handleConfirm} loading={submitting} />
      <Button
        label="Pay in full instead"
        variant="ghost"
        onPress={() => router.back()}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}
