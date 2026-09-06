"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Circle,
  Play,
  Sparkles,
  Loader2,
  Plus,
  BrainCircuit,
} from "lucide-react";
import { Problem } from "@/lib/problems";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProblemsClientProps {
  initialProblems: Problem[];
  userId: string;
}

export default function ProblemsClient({
  initialProblems,
  userId,
}: ProblemsClientProps) {
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"coding" | "general">("coding");
  const [solvedProblems, setSolvedProblems] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Fetch solved problems on mount and when page becomes visible
  useEffect(() => {
    const fetchSolvedProblems = async () => {
      try {
        const res = await fetch("/api/submissions");
        if (res.ok) {
          const submissions = await res.json();
          // Get unique problem IDs where status is Accepted
          const solvedIds = new Set<string>(
            submissions
              .filter((sub: any) => sub.status === "Accepted")
              .map((sub: any) => String(sub.problemId)),
          );
          setSolvedProblems(solvedIds);
        }
      } catch (error) {
        console.error("Failed to fetch solved problems", error);
      }
    };

    fetchSolvedProblems();

    // Refetch when user navigates back to this page
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSolvedProblems();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", fetchSolvedProblems);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", fetchSolvedProblems);
    };
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    try {
      console.log("🔄 Generating problem with:", { topic, type, userId });
      const res = await fetch("/api/generate-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, type, userId }),
      });

      console.log("📡 API Response Status:", res.status, res.statusText);

      if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ API Error Response:", errorData);
        throw new Error(
          errorData.error || errorData.details || "Failed to generate problem",
        );
      }

      const data = await res.json();
      console.log("✅ API Response:", data);

      if (data.problems && Array.isArray(data.problems)) {
        console.log(`➕ Adding ${data.problems.length} problems to list`);
        setProblems((prev) => {
          const updated = [...data.problems, ...prev];
          console.log("📋 Updated problems list:", updated);
          return updated;
        });
        setIsDialogOpen(false);
        setTopic("");
        console.log(
          `✅ Success! Generated ${data.problems.length} ${type === "coding" ? "coding" : "general"} problems.`,
        );
      } else if (data.problem) {
        // Fallback for backward compatibility if API returns single object
        console.log("➕ Adding problem to list:", data.problem);
        setProblems((prev) => {
          const updated = [data.problem, ...prev];
          console.log("📋 Updated problems list:", updated);
          return updated;
        });
        setIsDialogOpen(false);
        setTopic("");
        console.log(
          `✅ Success! Generated ${type === "coding" ? "coding" : "general"} problem: ${data.problem.title}`,
        );
      } else {
        throw new Error("No problems returned from API");
      }
    } catch (error) {
      console.error("Failed to generate problem:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate problem. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Coding & General Problems
          </h1>
          <p className="text-muted-foreground">
            Master any subject with AI-curated challenges.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-md">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate New Problem (AI)
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Generate a Problem</DialogTitle>
              <DialogDescription>
                Enter a topic and choose the problem type. AI will create a
                unique challenge for you.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="topic" className="text-right">
                  Topic
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g. Project Management, React Hooks..."
                  className="col-span-3"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Button
                    type="button"
                    variant={type === "coding" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setType("coding")}
                  >
                    Coding
                  </Button>
                  <Button
                    type="button"
                    variant={type === "general" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setType("general")}
                  >
                    General / Theory
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 border-b bg-muted/50 p-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1 text-center">Type</div>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Difficulty</div>
          <div className="col-span-2">Tags</div>
          <div className="col-span-2 text-right pr-4">Action</div>
        </div>
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {problems.map((problem) => (
            <div
              key={problem.id}
              className="grid grid-cols-12 items-center p-4 hover:bg-muted/30 transition-all duration-200 group"
            >
              <div className="col-span-1 flex justify-center">
                {problem.type === "general" ? (
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200 text-[10px]"
                  >
                    TEXT
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 text-[10px]"
                  >
                    CODE
                  </Badge>
                )}
              </div>
              <div className="col-span-5 font-semibold text-slate-700 dark:text-slate-200">
                <Link
                  href={`/dashboard/problems/${problem.id}`}
                  className="hover:text-primary transition-colors flex items-center gap-2"
                >
                  {solvedProblems.has(String(problem.id)) && (
                    <CheckCircle className="h-4 w-4 text-green-500 fill-green-500" />
                  )}
                  {problem.title}
                </Link>
              </div>
              <div className="col-span-2">
                <Badge
                  variant="outline"
                  className={
                    problem.difficulty === "Easy"
                      ? "border-green-200 text-green-700 bg-green-50"
                      : problem.difficulty === "Medium"
                        ? "border-amber-200 text-amber-700 bg-amber-50"
                        : "border-red-200 text-red-700 bg-red-50"
                  }
                >
                  {problem.difficulty}
                </Badge>
              </div>
              <div className="col-span-2 flex gap-1 flex-wrap">
                {problem.tags &&
                  problem.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
              <div className="col-span-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="hover:bg-primary hover:text-white transition-all group-hover:px-4"
                >
                  <Link href={`/dashboard/problems/${problem.id}`}>
                    Solve <Play className="ml-1 h-3 w-3 fill-current" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
          {problems.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <BrainCircuit className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <p className="font-semibold text-sm">No problems generated yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;Generate with AI&quot; above to create personalized practice problems.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
