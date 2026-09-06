import dotenv from "dotenv";
import { generateProblem } from "./src/lib/gemini";
import { createProblem } from "./src/lib/problems";

// Load env vars
dotenv.config({ path: ".env.local" });

const TOPICS = [
  { topic: "Array Manipulation", isCoding: true },
  { topic: "Linked List Reversal", isCoding: true },
  { topic: "Binary Tree Traversal", isCoding: true },
  { topic: "Dynamic Programming - Knapsack", isCoding: true },
  { topic: "System Design - Scalability", isCoding: false },
  { topic: "Object Oriented Programming Principles", isCoding: false },
];

async function seed() {
  console.log("🌱 Starting to seed problems...");

  for (const { topic, isCoding } of TOPICS) {
    console.log(`\n🤖 Generating problem for: ${topic}...`);
    try {
      const problemData = await generateProblem(topic, isCoding);
      const list = Array.isArray(problemData) ? problemData : [problemData];

      // Ensure type is distinct for each generated problem
      for (const problem of list) {
        problem.type = isCoding ? "coding" : "general";
        const saved = await createProblem(problem);
        console.log(`✅ Saved: ${saved.title} (${saved.id})`);
      }

      // Short delay to avoid rate limits if any
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.error(`❌ Failed to generate ${topic}:`, e);
    }
  }

  console.log("\n✨ Seeding complete!");
}

seed();
