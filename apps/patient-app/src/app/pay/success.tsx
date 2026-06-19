import { View, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { colors, spacing, typography, radius } from "@/lib/theme";

export default function SuccessScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: radius.full,
          backgroundColor: "#d1fae5",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}
      >
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
      </View>
      <Text style={{ ...typography.heading2, color: colors.ink, textAlign: "center", marginBottom: spacing.sm }}>
        Payment confirmed
      </Text>
      <Text style={{ ...typography.body, color: colors.muted, textAlign: "center", marginBottom: spacing.xl }}>
        Thank you. A receipt has been sent to your email on file. Your updated balance will appear shortly.
      </Text>
      <Button
        label="Back to my bill"
        onPress={() => router.replace("/(tabs)")}
        style={{ width: "100%" }}
      />
    </View>
  );
}
