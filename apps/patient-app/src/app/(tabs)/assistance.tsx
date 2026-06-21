import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { colors, spacing, typography, radius } from "@/lib/theme";

const PROGRAMS = [
  {
    id: "medicaid",
    title: "Medicaid",
    subtitle: "Free or low-cost coverage for qualifying individuals & families",
    eligibility: "Income up to 138% FPL",
    badge: "May qualify" as const,
    badgeVariant: "warning" as const,
    icon: "heart-circle-outline" as const,
  },
  {
    id: "charity",
    title: "Charity Care",
    subtitle: "Our health system's financial assistance program for uninsured or underinsured patients",
    eligibility: "Income up to 400% FPL",
    badge: "Apply now" as const,
    badgeVariant: "info" as const,
    icon: "ribbon-outline" as const,
  },
  {
    id: "aca",
    title: "ACA Marketplace Plan",
    subtitle: "Find a subsidized insurance plan at healthcare.gov",
    eligibility: "Open enrollment or qualifying event",
    badge: "Explore" as const,
    badgeVariant: "neutral" as const,
    icon: "shield-outline" as const,
  },
  {
    id: "discount",
    title: "Prompt-Pay Discount",
    subtitle: "Pay your balance in full today and receive up to 30% off",
    eligibility: "Available on current statement",
    badge: "Save up to 30%" as const,
    badgeVariant: "success" as const,
    icon: "pricetag-outline" as const,
  },
];

export default function AssistanceTab() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      <Text style={{ ...typography.body, color: colors.muted, marginBottom: spacing.lg }}>
        You may qualify for programs that reduce or eliminate your balance. Our team can help you apply.
      </Text>

      {PROGRAMS.map((program) => (
        <TouchableOpacity key={program.id} activeOpacity={0.85}>
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.full,
                  backgroundColor: colors.sky,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ionicons name={program.icon} size={22} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                  <Text style={{ ...typography.body, fontWeight: "700", color: colors.ink, flex: 1 }}>
                    {program.title}
                  </Text>
                  <Badge label={program.badge} variant={program.badgeVariant} />
                </View>
                <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 4 }}>
                  {program.subtitle}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <Ionicons name="person-outline" size={12} color={colors.muted} />
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    {program.eligibility}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ alignSelf: "center" }} />
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {/* Contact billing */}
      <Card variant="sky" style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <Ionicons name="call-outline" size={24} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.body, fontWeight: "600", color: colors.navy }}>
              Talk to a billing specialist
            </Text>
            <Text style={{ ...typography.bodySmall, color: colors.muted, marginTop: 2 }}>
              Our team can guide you through every assistance option.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => Linking.openURL("tel:+18005551234")}
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.navy,
            borderRadius: radius.md,
            paddingVertical: 12,
            alignItems: "center",
          }}
          activeOpacity={0.85}
        >
          <Text style={{ ...typography.body, fontWeight: "600", color: colors.white }}>
            Call billing
          </Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}
