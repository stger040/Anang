import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStoredOrg, getStoredToken, askAiBillQuestion } from "@/lib/api";
import { colors, spacing, typography, radius } from "@/lib/theme";

type Message = { role: "user" | "ai"; text: string };

const SUGGESTED_QUESTIONS = [
  "Why am I getting this bill?",
  "What did my insurance cover?",
  "Can I set up a payment plan?",
  "What is an HSA?",
  "How do I apply for financial assistance?",
];

export default function AskAiScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Hi! I can help explain your bill in plain English. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const org = await getStoredOrg();
      const token = await getStoredToken();
      const { answer } = await askAiBillQuestion(org ?? "", token ?? "", q);
      setMessages((prev) => [...prev, { role: "ai", text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I wasn't able to get an answer right now. Please call our billing team or try again later.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.cream }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 8 }}
      >
        {messages.map((msg, i) => (
          <View
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              marginBottom: spacing.sm,
            }}
          >
            {msg.role === "ai" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Ionicons name="sparkles" size={12} color={colors.navy} />
                <Text style={{ ...typography.caption, color: colors.navy, fontWeight: "600" }}>
                  ANANG AI
                </Text>
              </View>
            )}
            <View
              style={{
                backgroundColor: msg.role === "user" ? colors.navy : colors.white,
                borderRadius: radius.lg,
                borderBottomRightRadius: msg.role === "user" ? 4 : radius.lg,
                borderBottomLeftRadius: msg.role === "ai" ? 4 : radius.lg,
                padding: spacing.md,
                borderWidth: msg.role === "ai" ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  ...typography.body,
                  color: msg.role === "user" ? colors.white : colors.ink,
                }}
              >
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={{ alignSelf: "flex-start", padding: spacing.md }}>
            <ActivityIndicator color={colors.navy} />
          </View>
        )}

        {/* Suggested questions (only at start) */}
        {messages.length === 1 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ ...typography.label, color: colors.muted, marginBottom: spacing.sm }}>
              SUGGESTED QUESTIONS
            </Text>
            {SUGGESTED_QUESTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => send(q)}
                style={{
                  backgroundColor: colors.sky,
                  borderRadius: radius.full,
                  paddingVertical: 8,
                  paddingHorizontal: spacing.md,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignSelf: "flex-start",
                }}
                activeOpacity={0.85}
              >
                <Text style={{ ...typography.bodySmall, color: colors.navy }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.white,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your bill…"
          placeholderTextColor={colors.muted}
          multiline
          style={{
            flex: 1,
            ...typography.body,
            color: colors.ink,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            maxHeight: 120,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          blurOnSubmit
        />
        <TouchableOpacity
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: input.trim() && !loading ? colors.coral : colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
