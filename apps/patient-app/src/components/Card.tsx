import { View, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "navy" | "sky";
};

export function Card({ children, style, variant = "default" }: Props) {
  const bg =
    variant === "navy"
      ? colors.navy
      : variant === "sky"
        ? colors.sky
        : colors.white;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: variant === "default" ? 1 : 0,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
