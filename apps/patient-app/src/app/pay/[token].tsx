import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { colors, spacing, typography, radius } from "@/lib/theme";

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const PAYMENT_METHODS = [
  { id: "apple_pay", label: "Apple Pay", icon: "logo-apple" as const },
  { id: "card", label: "Credit / Debit card", icon: "card-outline" as const },
  { id: "bank", label: "Bank account (ACH)", icon: "business-outline" as const },
  { id: "paypal", label: "PayPal", icon: "logo-paypal" as const },
] as const;

export default function PaymentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [selectedMethod, setSelectedMethod] = useState<string>("card");
  const [paying, setPaying] = useState(false);

  // In production this would come from the API using the token
  const amountDueCents = 84700;
  const charges = [
    { id: "1", description: "Knee MRI — Oct 12, 2025", amountCents: 120000, patientShareCents: 84700 },
  ];

  async function handlePay() {
    setPaying(true);
    try {
      // TODO: integrate Stripe SDK / createPaymentIntent
      await new Promise((r) => setTimeout(r, 1200));
      router.replace("/pay/success");
    } catch {
      Alert.alert("Payment failed", "Please try again or contact billing.");
    } finally {
      setPaying(false);
    }
  }

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
        <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
          Due Nov 15, 2025
        </Text>
      </Card>

      {/* Charges breakdown */}
      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.sm }}>
        What you&apos;re paying for
      </Text>
      {charges.map((c) => (
        <Card key={c.id} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={{ ...typography.body, color: colors.ink, fontWeight: "600" }}>
                {c.description}
              </Text>
              <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 2 }}>
                Billed to insurance: {formatDollars(c.amountCents)}
              </Text>
            </View>
            <Text style={{ ...typography.body, fontWeight: "700", color: colors.coral }}>
              {formatDollars(c.patientShareCents)}
            </Text>
          </View>
        </Card>
      ))}

      {/* Payment plan option */}
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
            As low as $85/month — customize your schedule
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </TouchableOpacity>

      {/* Payment method */}
      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.sm }}>
        Payment method
      </Text>
      {PAYMENT_METHODS.map((method) => (
        <TouchableOpacity
          key={method.id}
          onPress={() => setSelectedMethod(method.id)}
          activeOpacity={0.85}
        >
          <Card
            style={{
              marginBottom: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              borderWidth: 2,
              borderColor: selectedMethod === method.id ? colors.navy : colors.border,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.full,
                borderWidth: 2,
                borderColor: selectedMethod === method.id ? colors.navy : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selectedMethod === method.id && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: radius.full,
                    backgroundColor: colors.navy,
                  }}
                />
              )}
            </View>
            <Ionicons name={method.icon} size={20} color={colors.navy} />
            <Text style={{ ...typography.body, color: colors.ink, flex: 1 }}>{method.label}</Text>
          </Card>
        </TouchableOpacity>
      ))}

      <Button
        label={`Pay ${formatDollars(amountDueCents)}`}
        onPress={handlePay}
        loading={paying}
        style={{ marginTop: spacing.md }}
      />

      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", marginTop: spacing.md }}>
        Secured by Stripe · HIPAA-compliant · We never store card details
      </Text>
    </ScrollView>
  );
}
