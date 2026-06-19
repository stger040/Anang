import { View, Text } from "react-native";
import { colors, radius, typography } from "@/lib/theme";

type Variant = "success" | "warning" | "error" | "info" | "neutral";

const map: Record<Variant, { bg: string; text: string }> = {
  success: { bg: "#d1fae5", text: colors.success },
  warning: { bg: "#fef3c7", text: "#92400e" },
  error: { bg: "#fee2e2", text: colors.error },
  info: { bg: colors.sky, text: colors.navy },
  neutral: { bg: "#f1f5f9", text: colors.muted },
};

type Props = { label: string; variant?: Variant };

export function Badge({ label, variant = "neutral" }: Props) {
  const { bg, text } = map[variant];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.full,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ ...typography.label, color: text }}>{label}</Text>
    </View>
  );
}
