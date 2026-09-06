import { generateProblem } from "./src/lib/gemini";
import fs from "fs";
import path from "path";

// Manually load .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
    console.log("✅ Loaded .env.local");
  } else {
    console.warn("⚠️ .env.local not found at", envPath);
  }
} catch (e) {
  console.error("❌ Failed to load .env.local", e);
}

async function verify() {
  console.log("🚀 Starting verification...");
  try {
    const problems = await generateProblem("Arrays", true);
    console.log("📦 Generated Problems:", problems);

    if (Array.isArray(problems) && problems.length > 1) {
      console.log(`✅ Success: Generated ${problems.length} problems.`);
    } else {
      console.error("❌ Failed: Did not generate multiple problems.", problems);
    }
  } catch (error) {
    console.error("❌ Error during verification:", error);
  }
}

verify();
