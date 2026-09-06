export {};

const reproFetch = require("node-fetch");

async function testExecute() {
  const payload = {
    language: "python",
    code: `def minOperations(A):\n    return len(A)`,
    mode: "run",
    problemId: "gen_u2s77b0kq", // Parity Alternation Cost (args: ["A"])
    runInput: "[1, 2, 3, 4]", // Value-style input, not assignment-style
  };

  try {
    const res = await reproFetch("http://localhost:3000/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Output:", data.output);
    console.log("Error:", data.error);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

testExecute();
