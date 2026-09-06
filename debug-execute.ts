export {};

const debugFetch = require("node-fetch");

async function debugExecute() {
  console.log("🚀 Starting Debug Execution...");

  const payload = {
    language: "python",
    code: `def minOperations(A):\n    return len(A)`,
    mode: "run",
    problemId: "gen_u2s77b0kq",
    runInput: "[10, 20, 30]",
  };

  try {
    console.log("📡 Sending request to /api/execute...");
    const res = await debugFetch("http://localhost:3000/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log(`📡 Response Status: ${res.status} ${res.statusText}`);
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      console.log("✅ Output:", data.output);
      console.log("❌ Error:", data.error);
      console.log("🐛 Debug Logs:", JSON.stringify(data.debugLogs, null, 2));
    } catch (e) {
      console.log("📄 Raw Response (Not JSON):", text);
    }
  } catch (e) {
    console.error("❌ Network/Fetch Error:", e);
  }
}

debugExecute();
