import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStoredOrg, getStoredToken, fetchPatientSummary, type PatientSummary } from "@/lib/api";
// getStoredOrg/getStoredToken used only for session guard check
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { colors, spacing, typography, radius } from "@/lib/theme";

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HomeTab() {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const org = await getStoredOrg();
      const token = await getStoredToken();
      if (!org || !token) {
        router.replace("/");
        return;
      }
      const data = await fetchPatientSummary();
      setSummary(data);
    } catch {
      setError("Couldn't load your bill. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  if (error || !summary) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.cream }}>
        <Text style={{ ...typography.body, color: colors.muted, textAlign: "center", marginBottom: spacing.md }}>
          {error ?? "Something went wrong."}
        </Text>
        <Button label="Try again" onPress={() => load()} />
      </View>
    );
  }

  const latestStatement = summary.statements[0] ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.navy} />
      }
    >
      {/* Org name */}
      <Text style={{ ...typography.label, color: colors.muted, marginBottom: spacing.sm }}>
        {summary.orgName.toUpperCase()}
      </Text>

      {/* Balance card */}
      <Card variant="navy" style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.label, color: "rgba(255,255,255,0.6)" }}>TOTAL BALANCE DUE</Text>
        <Text style={{ fontSize: 40, fontWeight: "800", color: colors.white, marginTop: 4 }}>
          {formatDollars(summary.totalOwedCents)}
        </Text>
        {latestStatement?.dueDateIso && (
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            Due {formatDate(latestStatement.dueDateIso)}
          </Text>
        )}
        <Button
          label="Pay Now"
          onPress={() => router.push("/pay/" + (latestStatement?.id ?? ""))}
          style={{ marginTop: spacing.md, backgroundColor: colors.coral }}
        />
        <TouchableOpacity
          onPress={() => router.push("/pay/plan")}
          style={{ marginTop: spacing.sm, alignItems: "center" }}
        >
          <Text style={{ ...typography.bodySmall, color: "rgba(255,255,255,0.65)" }}>
            Set up a payment plan
          </Text>
        </TouchableOpacity>
      </Card>

      {/* Ask AI */}
      <TouchableOpacity
        onPress={() => router.push("/ask-ai")}
        activeOpacity={0.85}
        style={{
          backgroundColor: colors.sky,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="sparkles" size={20} color={colors.navy} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.label, color: colors.navy }}>ASK AI</Text>
          <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 2 }}>
            "Why am I getting this bill?" — get a plain-English answer
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </TouchableOpacity>

      {/* Statements */}
      <Text style={{ ...typography.heading3, color: colors.ink, marginBottom: spacing.md }}>
        Your statements
      </Text>

      {summary.statements.length === 0 ? (
        <Card>
          <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>
            No statements yet.
          </Text>
        </Card>
      ) : (
        summary.statements.map((stmt) => (
          <TouchableOpacity
            key={stmt.id}
            onPress={() => router.push("/pay/" + stmt.id)}
            activeOpacity={0.85}
          >
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, fontWeight: "600", color: colors.ink }}>
                    {formatDollars(stmt.amountDueCents)} due
                  </Text>
                  <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 2 }}>
                    Total billed: {formatDollars(stmt.totalCents)}
                  </Text>
                  {stmt.dueDateIso && (
                    <Text style={{ ...typography.bodySmall, color: colors.muted }}>
                      Due {formatDate(stmt.dueDateIso)}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Badge
                    label={stmt.status}
                    variant={
                      stmt.status === "PAID"
                        ? "success"
                        : stmt.status === "OVERDUE"
                          ? "error"
                          : "info"
                    }
                  />
                  {stmt.paymentPlan && (
                    <Badge label="Plan active" variant="neutral" />
                  )}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      {/* Helpful links */}
      <Text style={{ ...typography.heading3, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.md }}>
        Other options
      </Text>
      {[
        {
          icon: "shield-checkmark-outline" as const,
          label: "Check my coverage",
          sub: "See what insurance is on file",
          route: "/(tabs)/coverage",
        },
        {
          icon: "heart-outline" as const,
          label: "Financial assistance",
          sub: "Medicaid, charity care, and more",
          route: "/(tabs)/assistance",
        },
      ].map((item) => (
        <TouchableOpacity
          key={item.label}
          onPress={() => router.push(item.route as never)}
          activeOpacity={0.85}
        >
          <Card style={{ marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                backgroundColor: colors.sky,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon} size={20} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, fontWeight: "600", color: colors.ink }}>{item.label}</Text>
              <Text style={{ ...typography.bodySmall, color: colors.muted }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
