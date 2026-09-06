import dbConnect from "@/lib/db";
import Problem, { IProblem } from "@/models/Problem";
import mongoose from "mongoose";

// Re-exporting interfaces for compatibility
export type { IProblem as Problem };
export interface TestCase {
  id: string;
  input: string;
  output: string;
  isHidden: boolean;
  explanation?: string | null;
}

export async function getProblems(userId?: string): Promise<IProblem[]> {
  await dbConnect();
  const query = userId ? { userId } : {};
  const problems = await Problem.find(query).sort({ createdAt: -1 });
  // Mongoose documents need to be converted to objects if passing to client components
  return JSON.parse(JSON.stringify(problems));
}

export async function getProblemById(id: string | number): Promise<IProblem | null> {
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/problems/${id}`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Fallback to direct DB connection
  }

  await dbConnect();
  let problem;

  if (mongoose.Types.ObjectId.isValid(id.toString())) {
    problem = await Problem.findById(id);
  }

  if (!problem) {
    problem = await Problem.findOne({ slug: id.toString() });
  }

  if (!problem) return null;

  return JSON.parse(JSON.stringify(problem));
}

export async function createProblem(problemData: any, userId?: string): Promise<IProblem> {
  await dbConnect();

  // Ensure we don't duplicate slugs
  const existing = await Problem.findOne({ slug: problemData.slug });
  if (existing) {
    problemData.slug = `${problemData.slug}-${Math.random().toString(36).substr(2, 5)}`;
  }

  if (userId) {
    problemData.userId = userId;
  }

  const newProblem = await Problem.create(problemData);
  return JSON.parse(JSON.stringify(newProblem));
}

export async function updateProblem(
  id: string | number,
  updatedFields: Partial<IProblem>,
): Promise<IProblem | null> {
  await dbConnect();
  const problem = await Problem.findByIdAndUpdate(id, updatedFields, { new: true });
  if (!problem) return null;
  return JSON.parse(JSON.stringify(problem));
}

export async function deleteProblem(id: string | number): Promise<boolean> {
  await dbConnect();
  const result = await Problem.findByIdAndDelete(id);
  return !!result;
}

// Helper to save multiple problems (e.g. seeding)
export async function saveProblems(problems: any[]) {
  await dbConnect();
  // This is a bit disparate from the previous "save whole file" approach.
  // We'll treat this as "create if not exists" or just bulk insert.
  for (const p of problems) {
    await createProblem(p);
  }
}
