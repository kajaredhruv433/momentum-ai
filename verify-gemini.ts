import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";

// Load env vars
dotenv.config({ path: ".env.local" });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("🔑 API Key present:", !!apiKey);
  if (!apiKey) {
    console.error("❌ No API key found in .env.local");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  console.log("🤖 Generating test content with gemini-2.0-flash...");

  try {
    const prompt = `
            Generate a simple JSON object: { "hello": "world" }
            STRICTLY JSON.
        `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("✅ Response received:");
    console.log(text);

    try {
      JSON.parse(text);
      console.log("✅ JSON parsed successfully");
    } catch (e) {
      console.error("❌ JSON parsing failed");
    }
  } catch (e) {
    console.error("❌ Generation failed:", e);
  }
}

main();
