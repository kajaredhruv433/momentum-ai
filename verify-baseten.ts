import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: "frontend/.env.local" });

async function main() {
  const apiKey = process.env.BASETEN_API_KEY;
  console.log("🔑 Baseten API Key present:", !!(apiKey && apiKey !== "your_baseten_api_key_here"));

  if (!apiKey || apiKey === "your_baseten_api_key_here") {
    console.error("❌ No real BASETEN_API_KEY found in frontend/.env.local");
    return;
  }

  const client = new OpenAI({
    baseURL: process.env.BASETEN_BASE_URL || "https://inference.baseten.co/v1",
    apiKey: apiKey,
  });

  const model = process.env.BASETEN_MODEL || "meta-models/muse-spark-open-1026";
  console.log(`🤖 Generating test content with ${model}...`);

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: "Generate a simple JSON object: { \"hello\": \"world\" }. STRICTLY JSON." }],
    });

    const text = response.choices[0]?.message?.content || "";
    console.log("✅ Response received:");
    console.log(text);
  } catch (e) {
    console.error("❌ Generation failed:", e);
  }
}

main();
