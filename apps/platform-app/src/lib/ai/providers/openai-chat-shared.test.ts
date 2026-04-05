import { describe, expect, it } from "vitest";
import {
  parseChatCompletionText,
  type ChatCompletionsJson,
} from "./openai-chat-shared";

describe("parseChatCompletionText", () => {
  it("returns trimmed assistant content", () => {
    const j: ChatCompletionsJson = {
      choices: [{ message: { content: "  Hello world.  " } }],
    };
    expect(parseChatCompletionText(j)).toBe("Hello world.");
  });

  it("returns null when empty", () => {
    expect(parseChatCompletionText({ choices: [] })).toBeNull();
    expect(
      parseChatCompletionText({
        choices: [{ message: { content: "   " } }],
      }),
    ).toBeNull();
  });
});
