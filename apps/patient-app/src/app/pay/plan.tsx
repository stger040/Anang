import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { fetchStatement, acknowledgePaymentPlan, type Statement } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { colors, spacing, typography, radius } from "@/lib/theme";

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Build payment step options: 8 evenly spaced between ~10% and 100% of total. */
function buildSteps(totalCents: number): number[] {
  const steps: number[] = [];
  for (let i = 1; i <= 8; i++) {
    const raw = Math.round((totalCents * i) / 8 / 100) * 100;
    steps.push(Math.max(100, Math.min(raw, totalCents)));
  }
  return [...new Set(steps)];
}

export default function PlanScreen() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<"monthly" | "biweekly">("monthly");
  const [installmentCents, setInstallmentCents] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchStatement();
      setStatement(data);
      // Default installment = ~10% of balance
      const steps = buildSteps(data.amountDueCents);
      setInstallmentCents(steps[1] ?? steps[0] ?? data.amountDueCents);
    } catch {
      Alert.alert("Couldn't load your bill", "Please go back and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !statement || installmentCents === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  const totalCents = statement.amountDueCents;
  const steps = buildSteps(totalCents);
  const intervalWeeks = frequency === "monthly" ? 4 : 2;
  const numPayments = Math.ceil(totalCents / installmentCents);
  const totalWeeks = numPayments * intervalWeeks;
  const totalMonths = Math.ceil(totalWeeks / 4);
  const frequencyLabel = frequency === "monthly" ? "/month" : "/bi-weekly";

  async function handleConfirm() {
    if (!statement) return;
    setSubmitting(true);
    try {
      // If a plan already exists (offered), acknowledge it; otherwise just navigate to success
      // (the platform creates the plan on acknowledgement or a staff flow creates it first)
      if (statement.paymentPlan?.id && statement.paymentPlan.status === "offered") {
        await acknowledgePaymentPlan(statement.paymentPlan.id);
      }
      router.replace("/pay/success");
    } catch {
      Alert.alert(
        "Couldn't confirm plan",
        "Please try again or call billing to set up a plan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* Balance summary */}
      <Card variant="navy" style={{ marginBottom: spacing.lg, alignItems: "center" }}>
        <Text style={{ ...typography.label, color: "rgba(255,255,255,0.6)" }}>TOTAL BALANCE</Text>
        <Text style={{ fontSize: 32, fontWeight: "800", color: colors.white, marginTop: 4 }}>
          {formatDollars(totalCents)}
        </Text>
      </Card>

      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.sm }}>
        Customize your plan
      </Text>
      <Text style={{ ...typography.bodySmall, color: colors.muted, marginBottom: spacing.lg }}>
        Your plan can be edited or cancelled anytime.
      </Text>

      {/* Frequency toggle */}
      <Text style={{ ...typography.label, color: colors.muted, marginBottom: spacing.sm }}>
        PAYMENT FREQUENCY
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

      {/* Selected amount display */}
      <Card style={{ marginBottom: spacing.lg, alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "800", color: colors.navy }}>
          {formatDollars(installmentCents)}{frequencyLabel}
        </Text>
        <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 4 }}>
          {numPayments} {frequency === "monthly" ? "monthly" : "bi-weekly"} payments ·{" "}
          ~{totalMonths} {totalMonths === 1 ? "month" : "months"} total
        </Text>
      </Card>

      {/* Amount selector chips */}
      <Text style={{ ...typography.label, color: colors.muted, marginBottom: spacing.sm }}>
        CHOOSE A {frequency === "monthly" ? "MONTHLY" : "BI-WEEKLY"} AMOUNT
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
        {steps.map((step) => (
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
        <Text style={{ fontSize: 16, color: colors.success }}>✓</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodySmall, fontWeight: "600", color: colors.navy }}>
            Auto-Pay available
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>
            Enable Auto-Pay after confirming your plan so you never miss a payment. Future statements are added automatically.
          </Text>
        </View>
      </View>

      <Button
        label="Confirm payment plan"
        onPress={handleConfirm}
        loading={submitting}
      />
      <Button
        label="Pay in full instead"
        variant="ghost"
        onPress={() => router.back()}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}
