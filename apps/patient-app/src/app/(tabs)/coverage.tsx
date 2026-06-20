import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchStatement, acknowledgePaymentPlan, type Statement } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { colors, spacing, typography, radius } from "@/lib/theme";

function ProgressBar({ value, max, color = colors.coral }: { value: number; max: number; color?: string }) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: radius.full, marginTop: 6 }}>
      <View
        style={{
          height: "100%",
          width: `${pct * 100}%`,
          backgroundColor: pct >= 1 ? colors.success : color,
          borderRadius: radius.full,
        }}
      />
    </View>
  );
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoverageTab() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStatement();
      setStatement(data);
    } catch {
      setError("Couldn't load coverage details. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  const coverage = statement?.coverage ?? null;

  if (!coverage) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.cream }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      >
        <Card variant="sky" style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Ionicons name="shield-outline" size={40} color={colors.navy} />
          <Text style={{ ...typography.heading3, color: colors.navy, marginTop: spacing.md, textAlign: "center" }}>
            No insurance on file
          </Text>
          <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: spacing.sm, textAlign: "center" }}>
            If you have insurance that should apply to this bill, call our billing team — we can check and re-submit.
          </Text>
        </Card>
        <Button
          label="Call billing"
          variant="secondary"
          onPress={() => {}}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    );
  }

  const effectiveFrom = formatDate(coverage.effectiveFrom);
  const effectiveTo = formatDate(coverage.effectiveTo);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* Plan card */}
      <Card variant="navy" style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.label, color: "rgba(255,255,255,0.6)" }}>INSURANCE ON FILE</Text>
            <Text style={{ ...typography.heading3, color: colors.white, marginTop: 4 }}>
              {coverage.planName ?? coverage.payerName}
            </Text>
          </View>
          <Badge label="Active" variant="success" />
        </View>
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
            {coverage.payerName}
          </Text>
          {coverage.memberId && (
            <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
              Member ID: {coverage.memberId}
            </Text>
          )}
          {coverage.groupNumber && (
            <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
              Group: {coverage.groupNumber}
            </Text>
          )}
          {effectiveFrom && (
            <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
              Effective: {effectiveFrom}{effectiveTo ? ` – ${effectiveTo}` : ""}
            </Text>
          )}
        </View>
      </Card>

      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.md }}>
        Your plan
      </Text>

      {/* Balance breakdown from statement */}
      {statement && (
        <>
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={{ ...typography.label, color: colors.muted }}>TOTAL BILLED</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.ink }}>
                {formatDollars(statement.totalCents)}
              </Text>
              <Text style={{ ...typography.bodySmall, color: colors.muted }}>Charged to insurance</Text>
            </View>
          </Card>

          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={{ ...typography.label, color: colors.muted }}>INSURANCE PAID</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.success }}>
                {formatDollars(statement.totalCents - statement.amountDueCents)}
              </Text>
              <Text style={{ ...typography.bodySmall, color: colors.muted }}>Covered by {coverage.payerName}</Text>
            </View>
            <ProgressBar
              value={statement.totalCents - statement.amountDueCents}
              max={statement.totalCents}
              color={colors.success}
            />
          </Card>

          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.label, color: colors.muted }}>YOUR SHARE</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.coral }}>
                {formatDollars(statement.amountDueCents)}
              </Text>
              <Text style={{ ...typography.bodySmall, color: colors.muted }}>Patient responsibility</Text>
            </View>
          </Card>
        </>
      )}

      <View
        style={{
          backgroundColor: colors.sky,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ ...typography.bodySmall, color: colors.navy }}>
          Coverage information comes from your insurer and may take 24–48 hours to reflect recent claims. If something looks wrong, call our billing team.
        </Text>
      </View>
    </ScrollView>
  );
}
