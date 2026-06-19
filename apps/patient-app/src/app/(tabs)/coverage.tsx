import { View, Text, ScrollView } from "react-native";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { colors, spacing, typography, radius } from "@/lib/theme";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: radius.full, marginTop: 6 }}>
      <View
        style={{
          height: "100%",
          width: `${pct * 100}%`,
          backgroundColor: pct >= 1 ? colors.success : colors.coral,
          borderRadius: radius.full,
        }}
      />
    </View>
  );
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CoverageTab() {
  // In production, fetch from API using stored token
  const coverage = {
    planName: "Blue Cross PPO Preferred",
    memberId: "XBC-00482-01",
    groupNumber: "G-44291",
    effectiveDate: "Jan 1, 2025",
    deductibleCents: 300000,
    deductibleMetCents: 187400,
    oopMaxCents: 700000,
    oopMetCents: 187400,
    copay: "$30 primary / $60 specialist",
    coinsurance: "80% after deductible",
  };

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
              {coverage.planName}
            </Text>
          </View>
          <Badge label="Active" variant="success" />
        </View>
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
            Member ID: {coverage.memberId}
          </Text>
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
            Group: {coverage.groupNumber}
          </Text>
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.6)" }}>
            Effective: {coverage.effectiveDate}
          </Text>
        </View>
      </Card>

      {/* Deductible */}
      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.md }}>
        Your 2025 benefits
      </Text>

      <Card style={{ marginBottom: spacing.sm }}>
        <Text style={{ ...typography.label, color: colors.muted }}>DEDUCTIBLE</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ ...typography.body, fontWeight: "700", color: colors.ink }}>
            {formatDollars(coverage.deductibleMetCents)} met
          </Text>
          <Text style={{ ...typography.bodySmall, color: colors.muted }}>
            of {formatDollars(coverage.deductibleCents)}
          </Text>
        </View>
        <ProgressBar value={coverage.deductibleMetCents} max={coverage.deductibleCents} />
        <Text style={{ ...typography.caption, color: colors.muted, marginTop: 6 }}>
          {formatDollars(coverage.deductibleCents - coverage.deductibleMetCents)} remaining before insurance pays 100%
        </Text>
      </Card>

      <Card style={{ marginBottom: spacing.sm }}>
        <Text style={{ ...typography.label, color: colors.muted }}>OUT-OF-POCKET MAXIMUM</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ ...typography.body, fontWeight: "700", color: colors.ink }}>
            {formatDollars(coverage.oopMetCents)} met
          </Text>
          <Text style={{ ...typography.bodySmall, color: colors.muted }}>
            of {formatDollars(coverage.oopMaxCents)}
          </Text>
        </View>
        <ProgressBar value={coverage.oopMetCents} max={coverage.oopMaxCents} />
        <Text style={{ ...typography.caption, color: colors.muted, marginTop: 6 }}>
          Once reached, insurance covers 100% of in-network costs
        </Text>
      </Card>

      {[
        { label: "Primary care copay", value: "$30" },
        { label: "Specialist copay", value: "$60" },
        { label: "Coinsurance", value: "80% after deductible" },
      ].map((item) => (
        <Card key={item.label} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...typography.body, color: colors.muted }}>{item.label}</Text>
            <Text style={{ ...typography.body, fontWeight: "600", color: colors.ink }}>{item.value}</Text>
          </View>
        </Card>
      ))}

      <View
        style={{
          backgroundColor: colors.sky,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginTop: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ ...typography.bodySmall, color: colors.navy }}>
          Coverage information is pulled directly from your insurer and may take 24–48 hours to reflect recent claims.
        </Text>
      </View>
    </ScrollView>
  );
}
