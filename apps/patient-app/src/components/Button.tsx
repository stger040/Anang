import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { colors, radius, typography } from "@/lib/theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: Props) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        {
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isPrimary
            ? colors.coral
            : isSecondary
              ? "transparent"
              : "transparent",
          borderWidth: isSecondary ? 1.5 : 0,
          borderColor: isSecondary ? colors.navy : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.navy} />
      ) : (
        <Text
          style={{
            ...typography.body,
            fontWeight: "600",
            color: isPrimary
              ? colors.white
              : isSecondary
                ? colors.navy
                : colors.coral,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
