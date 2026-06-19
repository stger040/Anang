import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { colors, spacing, typography, radius } from "@/lib/theme";
import { fetchStatementWithToken, createPaymentIntentWithToken, type Statement } from "@/lib/api";

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PaymentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [sheetReady, setSheetReady] = useState(false);

  const loadStatement = useCallback(async () => {
    if (!token) return;
    try {
      const stmt = await fetchStatementWithToken(token);
      setStatement(stmt);
    } catch (err) {
      Alert.alert("Unable to load bill", "Please try opening your payment link again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  // Pre-initialize the payment sheet as soon as statement is loaded
  useEffect(() => {
    if (!statement || !token) return;

    async function initSheet() {
      try {
        const { clientSecret } = await createPaymentIntentWithToken(token!, statement!.amountDueCents);
        const { error } = await initPaymentSheet({
          merchantDisplayName: "Anang Health",
          paymentIntentClientSecret: clientSecret,
          defaultBillingDetails: {},
          appearance: {
            colors: {
              primary: "#13264C",
              background: "#F7F5F2",
              componentBackground: "#FFFFFF",
              primaryText: "#1a1a2e",
            },
          },
        });
        if (!error) setSheetReady(true);
      } catch {
        // Non-fatal — user will see an error when they tap Pay
      }
    }

    initSheet();
  }, [statement, token, initPaymentSheet]);

  async function handlePay() {
    if (!sheetReady) {
      Alert.alert("Not ready", "Setting up payment, please try again in a moment.");
      return;
    }
    setPaying(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== "Canceled") {
          Alert.alert("Payment failed", error.message ?? "Please try again or contact billing.");
        }
      } else {
        router.replace("/pay/success");
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: spacing.md }}>
          Loading your bill…
        </Text>
      </View>
    );
  }

  if (!statement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={{ ...typography.heading3, color: colors.ink, marginTop: spacing.md, textAlign: "center" }}>
          Could not load bill
        </Text>
        <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: spacing.sm, textAlign: "center" }}>
          Try opening your payment link again, or call billing for help.
        </Text>
      </View>
    );
  }

  const amountDueCents = statement.amountDueCents;
  const dueDate = formatDate(statement.dueDateIso);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* Amount */}
      <Card variant="navy" style={{ marginBottom: spacing.lg }}>
        <Text style={{ ...typography.label, color: "rgba(255,255,255,0.6)" }}>AMOUNT DUE</Text>
        <Text style={{ fontSize: 36, fontWeight: "800", color: colors.white, marginTop: 4 }}>
          {formatDollars(amountDueCents)}
        </Text>
        {dueDate && (
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            Due {dueDate}
          </Text>
        )}
      </Card>

      {/* Charges breakdown */}
      {statement.charges.length > 0 && (
        <>
          <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.sm }}>
            What you&apos;re paying for
          </Text>
          {statement.charges.map((c) => (
            <Card key={c.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text style={{ ...typography.body, color: colors.ink, fontWeight: "600" }}>
                    {c.description}
                  </Text>
                  {c.code && (
                    <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>
                      Code: {c.code}
                    </Text>
                  )}
                </View>
                <Text style={{ ...typography.body, fontWeight: "700", color: colors.coral }}>
                  {formatDollars(c.amountCents)}
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Payment plan option */}
      {!statement.paymentPlan && (
        <TouchableOpacity
          onPress={() => router.push("/pay/plan")}
          style={{
            backgroundColor: colors.sky,
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.label, color: colors.navy }}>PREFER A PAYMENT PLAN?</Text>
            <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 2 }}>
              Spread your balance over time — customize your schedule
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
      )}

      {/* Active plan notice */}
      {statement.paymentPlan && statement.paymentPlan.status === "acknowledged" && (
        <Card variant="sky" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ ...typography.body, color: colors.navy, fontWeight: "600" }}>
              Payment plan active
            </Text>
          </View>
          <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 4 }}>
            {formatDollars(statement.paymentPlan.perInstallmentCents)} ×{" "}
            {statement.paymentPlan.installmentCount} installments
          </Text>
        </Card>
      )}

      <Button
        label={paying ? "Processing…" : `Pay ${formatDollars(amountDueCents)}`}
        onPress={handlePay}
        loading={paying || !sheetReady}
        style={{ marginTop: spacing.md }}
      />

      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", marginTop: spacing.md }}>
        Secured by Stripe · HIPAA-compliant · We never store card details
      </Text>
    </ScrollView>
  );
}
