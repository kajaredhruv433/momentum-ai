import { GoogleGenerativeAI } from "@google/generative-ai";

console.log(
  "Gemini Client Initializing. Key present:",
  !!process.env.GEMINI_API_KEY,
  "Length:",
  process.env.GEMINI_API_KEY?.length,
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key");

// Models to try in order of preference/stability
// Verified: gemini-2.5-flash is available
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite-preview-02-05", // Keeping as potential fallback if available
];

/**
 * retry wrapper for Gemini API calls
 * Implements exponential backoff and model fallback
 */
async function makeRequestWithRetry(
  prompt: string,
  generationConfig: any = { responseMimeType: "application/json" }
): Promise<string> {
  const maxRetries = 2; // Reduced retries to avoid long waits
  let lastError;

  for (const modelName of MODELS) {
    console.log(`🤖 Attempting with model: ${modelName}`);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes("429") || error.status === 429;
        const isNotFound = error.message?.includes("404") || error.status === 404; // Check if model exists

        if (isRateLimit) {
          console.warn(`⚠️ Rate limit hit for ${modelName} (Attempt ${attempt + 1}/${maxRetries + 1})`);
          if (attempt < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s...
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else if (isNotFound) {
          console.warn(`⚠️ Model ${modelName} not found, skipping...`);
          break; // Skip retries for this model if not found
        } else {
          // If it's not a rate limit, maybe throw immediately or try next model?
          // For now, let's treat other errors as fatal for this model but try next model
          console.error(`❌ Error with ${modelName}:`, error.message);
          break; // Break inner loop to try next model
        }
      }
    }
    console.warn(`⚠️ Failed with ${modelName}, trying next model...`);
  }

  throw lastError || new Error("All models and retries failed");
}

// List available models for debugging
(async () => {
  try {
    console.log("🔍 Checking available models for this API key...");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
    );
    const data = await response.json();
    if (data.models) {
      console.log("✅ Available models:");
      data.models.forEach((model: any) => {
        console.log(`  - ${model.name}`);
      });
    } else {
      console.log("❌ No models found or API error:", data);
    }
  } catch (error) {
    console.log("❌ Could not list models:", error);
  }
})();

export async function rateResume(resumeData: any, jobRequirements: string) {
  try {
    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      console.warn(
        "GEMINI_API_KEY is not set. Using domain-intelligent mock rating.",
      );

      // Local Mock Rating Logic - STRICT
      let score = 2.0; // Low base score for strictness
      const skills = (resumeData.skills || "").toLowerCase();
      const experience = resumeData.experience || [];
      const projects = resumeData.projects || [];
      const req = jobRequirements.toLowerCase();

      let feedback = "";
      let strengths = [];

      const isAiRole =
        req.includes("ai") ||
        req.includes("ml") ||
        req.includes("machine learning") ||
        req.includes("data scientist");
      const isFrontendRole =
        req.includes("frontend") ||
        req.includes("react") ||
        req.includes("web");
      const isBackendRole =
        req.includes("backend") ||
        req.includes("node") ||
        req.includes("server");

      // 1. Skill Match (Up to 4 points)
      const commonSkills = [
        "react",
        "next.js",
        "typescript",
        "tailwind",
        "node.js",
        "python",
        "java",
        "c++",
        "ai",
        "ml",
        "tensorflow",
        "pytorch",
        "javascript",
        "flutter",
        "dart",
        "aws",
        "docker",
        "mongodb",
        "postgresql",
        "sql",
        "pyspark",
        "stats",
        "go",
        "rust"
      ];

      let matchedSkills: string[] = [];
      commonSkills.forEach((skill) => {
        if (skills.includes(skill) && (req.includes(skill) || req === "all")) {
          matchedSkills.push(skill);
        }
      });

      // Domain-specific essential skill weights
      if (isAiRole) {
        const aiEssentials = [
          "python",
          "tensorflow",
          "pytorch",
          "ml",
          "ai",
          "scikit",
          "nlp",
        ];
        const aiMatches = aiEssentials.filter((s) => skills.includes(s));
        score += (aiMatches.length / aiEssentials.length) * 3.5;
        if (aiMatches.length > 0)
          strengths.push(
            `Strong proficiency in AI stack (${aiMatches.slice(0, 2).join(", ")}).`,
          );
      } else if (isFrontendRole) {
        const feEssentials = [
          "react",
          "next.js",
          "tailwind",
          "typescript",
          "javascript",
        ];
        const feMatches = feEssentials.filter((s) => skills.includes(s));
        score += (feMatches.length / feEssentials.length) * 3.5;
        if (feMatches.length > 0)
          strengths.push(
            `Expertise in modern frontend technologies (${feMatches.slice(0, 2).join(", ")}).`,
          );
      } else {
        // General match for other/all domains
        score += Math.min(3.5, (matchedSkills.length / 4) * 3.5);
      }

      // 2. Experience Relevance (Up to 2.5 points)
      if (experience.length > 0) {
        const expCount = experience.length;
        let relevanceWeight = 0.5; // default relevance

        experience.forEach((exp: any) => {
          const desc = (exp.role + " " + (exp.details || "")).toLowerCase();
          if (
            (isAiRole &&
              (desc.includes("ai") ||
                desc.includes("ml") ||
                desc.includes("data"))) ||
            (isFrontendRole &&
              (desc.includes("frontend") ||
                desc.includes("ui") ||
                desc.includes("react"))) ||
            (isBackendRole &&
              (desc.includes("backend") ||
                desc.includes("node") ||
                desc.includes("api")))
          ) {
            relevanceWeight += 1.0;
          }
        });

        const expScore = Math.min(2.5, expCount * 0.5 + relevanceWeight);
        score += expScore;
        if (relevanceWeight > 1.0)
          strengths.push(
            "Relevant professional background with direct domain experience.",
          );
      }

      // 3. Projects Relevance (Up to 2 points)
      if (projects.length > 0) {
        score += Math.min(2, projects.length * 0.7);
        strengths.push(
          `Proven hands-on experience through ${projects.length} significant project(s).`,
        );
      }

      // 4. Education (Up to 1 point)
      const education = resumeData.education || [];
      if (education.length > 0) {
        score += 0.5;
        const gpa = education[0].gpa || "";
        if (
          gpa &&
          (gpa.includes("3.8") ||
            gpa.includes("3.9") ||
            gpa.includes("4.0") ||
            gpa.includes("9."))
        ) {
          score += 0.5;
          strengths.push("Excellent academic track record (High GPA).");
        }
      }

      // Final Normalization
      score = Math.min(10.0, Math.max(7.0, score));

      const status =
        score >= 8.5 ? "Recommended" : score >= 7.0 ? "Reviewed" : "New";

      // Generate Summary Reason
      const summary =
        resumeData.personal?.summary ||
        "Developer with strong technical skills.";
      feedback = `REASON: ${strengths.join(" ")} Highlights: ${summary.split(".")[0]}. Suitable for ${jobRequirements.split(" ")[0]} roles due to balanced skill-to-experience ratio.`;

      return {
        score: parseFloat(score.toFixed(1)),
        status: status,
        feedback: feedback,
      };
    }

    const prompt = `
            You are a strict, no-nonsense technical recruiter. Rate the following resume against these job requirements.
            
            Job Requirements:
            ${jobRequirements}
            
            Resume:
            ${JSON.stringify(resumeData, null, 2)}
            
            Provide a rating between 7.0 and 10.0 based on skill match, experience, and projects.
            IMPORTANT: The rating MUST be at least 7.0 and at most 10.0.
            - 7.0 - 7.5: Basic match
            - 7.6 - 8.5: Good match
            - 8.6 - 9.5: Great match
            - 9.6 - 10.0: Exceptional match (Rare)
            
            Also provide a short status (one of: "Recommended", "Reviewed", "New", "Rejected").
            
            IMPORTANT: Provide a clear, professional REASON for your recommendation in the feedback field. 
            Highlight key strengths and missing critical skills.
            
            STRICTLY return ONLY a JSON object. Do NOT include markdown formatting.
            
            JSON Format:
            {
                "score": number, (out of 10, e.g., 7.5)
                "status": "string",
                "feedback": "string (Start with REASON: ...)"
            }
        `;

    const text = await makeRequestWithRetry(prompt);

    try {
      return cleanAndParseJSON(text);
    } catch (e) {
      console.error("AI Parse Error in rateResume:", e);
      return {
        score: 7.5,
        status: "Reviewed",
        feedback: "Matches majority of core requirements (AI Parse Fail).",
      };
    }
  } catch (error) {
    console.error("Gemini Rating Error:", error);
    return { score: 7.0, status: "Error", feedback: "AI rating failed." };
  }
}

export async function generateProblem(
  topic: string,
  isCoding: boolean = false,
): Promise<any[]> {
  console.log(
    `🤖 Starting problem generation for topic: "${topic}", isCoding: ${isCoding}`,
  );

  try {
    let prompt = "";

    if (isCoding) {
      prompt = `
            Generate 5 unique coding problems related to "${topic}".
            It should be a LeetCode style problem.
            
            STRICTLY return ONLY a JSON array of objects. Do NOT include markdown formatting, backticks, or any other element before or after the JSON.
            
            JSON Format:
            [
              {
                "title": "Problem Title",
                "description": "HTML formatted detailed description...",
                "difficulty": "Easy" | "Medium" | "Hard",
                "slug": "problem-slug",
                "status": "Unsolved",
                "tags": ["Tag1", "Tag2"],
                "type": "coding",
                "defaultCode": { "python": "def solution():\\n    pass", "javascript": "function solution() {}" },
                "functionName": "solution",
                "args": ["arg1"],
                "testCases": [
                   {"id": "1", "input": "...", "output": "...", "isHidden": false},
                   {"id": "2", "input": "...", "output": "...", "isHidden": true}
                ],
                "companies": [],
                "constraints": ["Constraint 1", "Constraint 2"]
              },
              ...
            ]
        `;
    } else {
      prompt = `
            Generate 5 theoretical, conceptual, or scenario-based interview questions related to "${topic}".
            
            IMPORTANT: These are NOT coding problems. Do NOT ask the user to write code, functions, or algorithms.
            Ask for explanation, design, or analysis.
            
            STRICTLY return ONLY a JSON array of objects. Do NOT include markdown formatting, backticks, or any other element before or after the JSON.
            
            JSON Format:
            [
              {
                "title": "Problem Title",
                "description": "HTML formatted detailed scenario or question...",
                "difficulty": "Medium",
                "slug": "problem-slug",
                "status": "Unsolved",
                "tags": ["Tag1", "Tag2"],
                "type": "general",
                "companies": [],
                "constraints": [] 
              },
              ...
            ]
            
            Do NOT include "defaultCode", "testCases", "functionName", or "args".
        `;
    }

    console.log("📝 Sending request to Gemini API...");
    const text = await makeRequestWithRetry(prompt);
    console.log("✅ Received response from Gemini API");

    console.log("📄 AI Response text length:", text.length);
    if (text.length > 500) {
      console.log("📄 First 200 chars:", text.substring(0, 200));
    } else {
      console.log("📄 Full response:", text);
    }

    try {
      let data = cleanAndParseJSON(text);

      // Ensure data is an array
      if (!Array.isArray(data)) {
        if (typeof data === "object" && data !== null) {
          // Handle case where single object is returned instead of array
          data = [data];
        } else {
          throw new Error("Parsed data is not an array");
        }
      }

      // Add random ID to avoid collisions for each problem
      data = data.map((prob: any) => ({
        ...prob,
        id: "gen_" + Math.random().toString(36).substr(2, 9),
      }));

      console.log(`✅ Successfully generated ${data.length} problems`);
      return data;
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      console.error("❌ Failed text content:", text);
      throw new Error("Failed to parse AI response as JSON");
    }
  } catch (e) {
    console.error("❌ AI Generation Error:", e);

    // FALLBACK: Generate mock problem when AI fails
    console.warn("⚠️ Gemini API failed. Using mock problem generation.");
    return generateMockProblem(topic, isCoding);
  }
}

function cleanAndParseJSON(text: string): any {
  // 1. Remove markdown code blocks
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "");

  // 2. Trim whitespace
  cleaned = cleaned.trim();

  // 3. Try parsing directly
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 4. If direct parse fails, try to find the first '[' and last ']' for arrays
    //    or first '{' and last '}' for objects, favoring arrays if we expect multiple.

    // Simple heuristic: Look for array first
    const firstArr = cleaned.indexOf("[");
    const lastArr = cleaned.lastIndexOf("]");

    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      const jsonSubstring = cleaned.substring(firstArr, lastArr + 1);
      try {
        return JSON.parse(jsonSubstring);
      } catch (innerError) {
        // try removing trailing commas
        try {
          return JSON.parse(jsonSubstring.replace(/,(\s*[\}\]])/g, "$1"));
        } catch { }
      }
    }

    const firstOpen = cleaned.indexOf("{");
    const lastClose = cleaned.lastIndexOf("}");

    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      const jsonSubstring = cleaned.substring(firstOpen, lastClose + 1);
      try {
        return JSON.parse(jsonSubstring);
      } catch (innerError) {
        // 5. Last resort: try to fix common trailing items
        try {
          return JSON.parse(jsonSubstring.replace(/,(\s*[\}\]])/g, "$1")); // Remove trailing commas
        } catch {
          throw e; // Throw original error if strict extraction failed
        }
      }
    }
    throw e;
  }
}

// Mock problem generation fallback
function generateMockProblem(topic: string, isCoding: boolean): any[] {
  const problems = [];

  for (let i = 0; i < 5; i++) {
    const id = "gen_" + Math.random().toString(36).substr(2, 9);
    const slug = `${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i + 1}`;

    if (isCoding) {
      problems.push({
        id,
        title: `${topic} Challenge ${i + 1}`,
        description: `<p>This is a coding problem related to <strong>${topic}</strong> (${i + 1}).</p><p><em>Note: This is a mock problem generated because the AI API is unavailable. Please configure a valid Gemini API key for AI-generated problems.</em></p>`,
        difficulty: ["Easy", "Medium", "Hard"][i % 3] as any,
        slug,
        status: "Unsolved" as const,
        tags: [topic, "Mock", "Practice"],
        type: "coding" as const,
        defaultCode: {
          python: `def solution():\n    # TODO: Implement your solution for ${topic} ${i + 1}\n    pass`,
          javascript: `function solution() {\n    // TODO: Implement your solution for ${topic} ${i + 1}\n}`,
        },
        functionName: "solution",
        args: ["input"],
        testCases: [
          {
            id: "1",
            input: "test_input",
            output: "expected_output",
            isHidden: false,
          },
        ],
        companies: [],
        constraints: ["Mock problem"],
      });
    } else {
      problems.push({
        id,
        title: `${topic} Concept ${i + 1}`,
        description: `<p>This is a theoretical question about <strong>${topic}</strong> (${i + 1}).</p><p><em>Note: This is a mock problem.</em></p>`,
        difficulty: ["Easy", "Medium", "Hard"][i % 3] as any,
        slug,
        status: "Unsolved" as const,
        tags: [topic, "Theory", "Mock"],
        type: "general" as const,
        companies: [],
        constraints: [],
      });
    }
  }
  return problems;
}

export async function evaluateAnswer(
  problemDesc: string,
  userAnswer: string,
): Promise<any> {
  const prompt = `
        Analyze the following user answer to a problem.
        
        Problem Description:
        ${problemDesc}
        
        User Answer:
        ${userAnswer}
        
        Rate the answer on a scale of 0-10.
        Provide constructive feedback and suggestions for improvement.
        
        STRICTLY return ONLY a JSON object. Do NOT include markdown formatting.

        JSON Format:
        {
            "rating": number,
            "feedback": "string",
            "suggestions": ["string"]
        }
    `;

  try {
    const text = await makeRequestWithRetry(prompt);
    return cleanAndParseJSON(text);
  } catch (e) {
    console.error("AI Evaluation Error:", e);
    return { rating: 0, feedback: "AI evaluation failed", suggestions: [] };
  }
}

export async function analyzeResume(resumeData: any) {
  try {
    const prompt = `
        Act as a senior technical recruiter and career coach. Analyze the following resume data to provide a comprehensive rating and actionable feedback.
        
        Resume Data:
        ${JSON.stringify(resumeData, null, 2)}
        
        Evaluate based on:
        1. Impact & Results (Quantifiable achievements)
        2. Skills Match (Relevance to modern standards)
        3. Experience Quality (Progression and depth)
        4. Education & Certifications
        
        STRICTLY return ONLY a JSON object. Do NOT include markdown formatting.
        
        JSON Format:
        {
            "score": number, (0-100)
            "status": "Strong" | "Good" | "Needs Improvement",
            "feedback": "string (General summary)",
            "strengths": ["string", "string", "string"], (Top 3 strengths)
            "improvements": ["string", "string", "string"] (Top 3 specific areas to improve)
        }
    `;

    const text = await makeRequestWithRetry(prompt);
    return cleanAndParseJSON(text);
  } catch (error) {
    console.error("AI Resume Analysis Error:", error);
    return {
      score: 0,
      status: "Error",
      feedback: "AI analysis failed. Please try again.",
      strengths: [],
      improvements: []
    };
  }
}

export async function generateJobDescription(jobTitle: string, jobType: string, jobLocation: string, jobSalary: string) {
  try {
    const prompt = `
        Act as a professional HR specialist and Technical Recruiter. Write a compelling "About the Role" summary for the following position:
        
        Job Title: ${jobTitle}
        Type: ${jobType}
        Location: ${jobLocation}
        Salary Range: ${jobSalary}
        
        The summary should be engaging, inclusive, and clearer than typical corporate jargon.
        It should be a single paragraph describing the role's impact and the ideal candidate.
        
        IMPORTANT: 
        - Do NOT include a header (e.g., "About the Role").
        - Do NOT include Responsibilities, Requirements, or Benefits.
        - PROMISE: Only return the summary text paragraph.
        
        STRICTLY return ONLY a JSON object. Do NOT include markdown formatting.
        
        JSON Format:
        {
            "description": "string (The single paragraph summary)",
            "shortSummary": "string (Same as description)"
        }
    `;

    const text = await makeRequestWithRetry(prompt);
    return cleanAndParseJSON(text);
  } catch (error) {
    console.error("AI Job Description Generation Error:", error);
    return {
      description: "Failed to generate description. Please try again.",
      shortSummary: "Error"
    };
  }
}
