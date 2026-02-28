import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export { anthropic };

export async function claudeChat(options: {
  model?: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const {
    model = "claude-sonnet-4-6",
    system,
    prompt,
    temperature = 0.3,
    maxTokens = 8192,
  } = options;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
    ...(temperature !== undefined ? { temperature } : {}),
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

export async function claudeJSON(options: {
  model?: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<any> {
  const systemWithJSON = options.system
    ? `${options.system}\n\nYou MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON.`
    : "You MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON.";

  const text = await claudeChat({
    ...options,
    system: systemWithJSON,
  });

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}
