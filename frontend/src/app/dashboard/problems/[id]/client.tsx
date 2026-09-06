"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  MessageSquare,
  BrainCircuit,
  Loader2,
  XCircle,
  Lightbulb,
  BookOpen,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import Editor from "@monaco-editor/react";
import { Problem } from "@/lib/problems";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProblemWorkspaceClientProps {
  problem: Problem;
}

// Solution Tab Component
function SolutionTab({
  problemId,
  language,
}: {
  problemId: string;
  language: string;
}) {
  const [solution, setSolution] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSolution = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/solution?problemId=${problemId}&language=${language}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSolution(data.solution);
        } else {
          throw new Error("Failed to fetch solution");
        }
      } catch (err) {
        setError("Unable to load solution");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSolution();
  }, [problemId, language]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Solution</h3>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating solution...</span>
        </div>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="bg-muted p-4 rounded-md overflow-x-auto">
          <pre className="font-mono text-sm whitespace-pre-wrap">
            {solution}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ProblemWorkspaceClient({
  problem,
}: ProblemWorkspaceClientProps) {
  const isGeneral = problem.type === "general";

  const [code, setCode] = useState<string>("");
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [runtime, setRuntime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [language, setLanguage] = useState("python");
  const [evaluation, setEvaluation] = useState<any>(null);
  const [mentorship, setMentorship] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("testcase");
  const [activeDescTab, setActiveDescTab] = useState("description");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    // Set default code based on language
    if (!isGeneral) {
      if (problem.defaultCode && problem.defaultCode[language]) {
        setCode(problem.defaultCode[language]);
      } else if (problem.defaultCode) {
        setCode(Object.values(problem.defaultCode)[0] || "");
      }
    }
  }, [problem, language, isGeneral]);

  // Fetch submissions on mount
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch(`/api/submissions?problemId=${problem.id}`);
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data);
          if (data.length > 0) {
            setHasSubmitted(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch submissions", error);
      }
    };

    fetchSubmissions();
  }, [problem.id]);

  const handleRun = async () => {
    setIsRunning(true);
    setTestResults(null);
    setError(null);
    setRuntime(null);
    setEvaluation(null);
    setMentorship(null);

    // Switch to console tab when running
    if (!isGeneral) {
      setActiveTab("console");
    }

    try {
      if (isGeneral) {
        // Handle General Text Evaluation
        const res = await fetch("/api/evaluate-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId: problem.id,
            userAnswer: textAnswer,
          }),
        });

        const data = await res.json();
        setEvaluation(data);

        // Refresh submissions list to show the new submission
        const submissionsRes = await fetch(
          `/api/submissions?problemId=${problem.id}`,
        );
        if (submissionsRes.ok) {
          const submissionsData = await submissionsRes.json();
          setSubmissions(submissionsData);
          setHasSubmitted(true);
          setActiveDescTab("submissions");
        }
      } else {
        // Handle Code Execution - run against predefined test cases
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: language,
            code: code,
            mode: "run-tests",
            problemId: problem.id,
          }),
        });

        const data = await res.json();

        if (data.error) {
          let errorMessage = data.error;
          if (data.parsedError) {
            errorMessage += `\n\nSuggestion: ${data.parsedError.suggestion}`;
            if (data.parsedError.mentorship) {
              setMentorship(data.parsedError.mentorship);
            }
          }
          setError(errorMessage);
        } else if (data.testResults && data.testResults.length > 0) {
          setTestResults(data.testResults);
          setRuntime(data.runtime || null);
        } else {
          setError(data.output || "No output");
        }
      }
    } catch (err) {
      if (isGeneral) {
        setEvaluation({ error: "Failed to evaluate answer." });
      } else {
        setError("Failed to execute code");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    setIsRunning(true);
    setTestResults(null);
    setError(null);
    setRuntime(null);
    setEvaluation(null);
    setMentorship(null);

    // Switch to console tab when submitting
    if (!isGeneral) {
      setActiveTab("console");
    }

    try {
      // Handle Code Submission - run all test cases
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: language,
          code: code,
          mode: "submit",
          problemId: problem.id,
        }),
      });

      const data = await res.json();

      if (data.error) {
        let errorMessage = data.error;
        if (data.parsedError) {
          errorMessage += `\n\nSuggestion: ${data.parsedError.suggestion}`;
          if (data.parsedError.mentorship) {
            setMentorship(data.parsedError.mentorship);
          }
        }
        setError(errorMessage);
      } else if (data.testResults && data.testResults.length > 0) {
        setTestResults(data.testResults);
        setRuntime(data.runtime || null);

        // Calculate pass/fail status and save submission
        const passedCount = data.testResults.filter(
          (t: any) => t.status === "Passed",
        ).length;
        const totalCount = data.testResults.length;
        const status = passedCount === totalCount ? "Accepted" : "Failed";
        await saveSubmission(
          status,
          data.runtime || 0,
          passedCount,
          totalCount,
        );
      } else {
        setError(data.output || "No output");
      }
    } catch (err) {
      setError("Failed to submit code");
    } finally {
      setIsRunning(false);
    }
  };

  const saveSubmission = async (
    status: string,
    runtime: number,
    testsPassed: number,
    testsTotal: number,
  ) => {
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          code,
          language,
          status,
          runtime,
          testsPassed,
          testsTotal,
        }),
      });

      if (res.ok) {
        // Refresh submissions list
        const submissionsRes = await fetch(
          `/api/submissions?problemId=${problem.id}`,
        );
        if (submissionsRes.ok) {
          const submissionsData = await submissionsRes.json();
          setSubmissions(submissionsData);
          setHasSubmitted(true);
          setActiveDescTab("submissions");
        }
      }
    } catch (error) {
      console.error("Failed to save submission", error);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 mb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/problems"
            className="hover:bg-muted p-2 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold flex items-center gap-2">
              {problem.title}
              {isGeneral && (
                <Badge variant="secondary" className="text-xs">
                  Theory
                </Badge>
              )}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          {!isGeneral && (
            <Button
              variant="secondary"
              onClick={handleRun}
              disabled={isRunning}
            >
              <Play className="mr-2 h-4 w-4" /> Run Code
            </Button>
          )}
          <Button
            disabled={isRunning}
            onClick={isGeneral ? handleRun : handleSubmit}
            className={isGeneral ? "bg-indigo-600 hover:bg-indigo-700" : ""}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isGeneral ? "Evaluating..." : "Running..."}
              </>
            ) : (
              <>
                {isGeneral ? (
                  <BrainCircuit className="mr-2 h-4 w-4" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {isGeneral ? "Submit Answer" : "Submit"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: Description/Solution/Submissions */}
        <div className="w-1/3 flex flex-col rounded-xl border bg-card overflow-hidden">
          <Tabs
            value={activeDescTab}
            onValueChange={setActiveDescTab}
            className="flex flex-col h-full"
          >
            <TabsList className="bg-muted px-4 py-2 border-b justify-start rounded-none h-auto">
              <TabsTrigger value="description" className="text-sm">
                Description
              </TabsTrigger>
              {hasSubmitted && (
                <TabsTrigger value="solution" className="text-sm">
                  Solution
                </TabsTrigger>
              )}
              {hasSubmitted && (
                <TabsTrigger value="submissions" className="text-sm">
                  Submissions
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent
              value="description"
              className="flex-1 p-6 overflow-y-auto prose dark:prose-invert max-w-none m-0"
            >
              {problem.description.includes("<") ? (
                <div
                  dangerouslySetInnerHTML={{ __html: problem.description }}
                />
              ) : (
                <p className="whitespace-pre-wrap">{problem.description}</p>
              )}
            </TabsContent>

            <TabsContent
              value="solution"
              className="flex-1 p-6 overflow-y-auto m-0"
            >
              <SolutionTab
                problemId={problem.id.toString()}
                language={language}
              />
            </TabsContent>

            <TabsContent
              value="submissions"
              className="flex-1 p-6 overflow-y-auto m-0"
            >
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Submissions</h3>
                {submissions.length === 0 ? (
                  <p className="text-muted-foreground">No submissions yet</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((sub) => (
                      <Card
                        key={sub.id}
                        className={
                          sub.status === "Accepted"
                            ? "border-green-500/50"
                            : "border-red-500/50"
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge
                              className={
                                sub.status === "Accepted"
                                  ? "bg-green-600"
                                  : "bg-red-600"
                              }
                            >
                              {sub.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(sub.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>{sub.language}</span>
                            <span>Runtime: {sub.runtime}ms</span>
                            <span>
                              {sub.testsPassed}/{sub.testsTotal} passed
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Editor & Terminal */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
          {/* Editor Section */}
          <div className="flex-1 flex flex-col rounded-xl border bg-card overflow-hidden relative min-h-0">
            <div className="bg-muted px-4 py-2 border-b font-medium flex justify-between items-center shrink-0">
              {isGeneral ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4" /> Your Answer
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Language:
                  </span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-transparent border-none text-sm focus:ring-0 cursor-pointer font-medium text-foreground p-0"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                  </select>
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {isGeneral ? "Markdown Supported" : "Monaco Editor"}
              </span>
            </div>

            <div className="flex-1 relative min-h-0">
              {isGeneral ? (
                <textarea
                  className="w-full h-full p-6 bg-transparent resize-none focus:outline-none font-sans text-base leading-relaxed"
                  placeholder="Type your answer here..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                />
              ) : (
                <Editor
                  height="100%"
                  language={
                    language === "c" || language === "cpp" ? "cpp" : language
                  }
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                    automaticLayout: true,
                  }}
                />
              )}
            </div>

            {/* Evaluation Result Overlay (General Only) */}
            {isGeneral && evaluation && (
              <div className="absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t shadow-lg max-h-[50%] overflow-y-auto p-6 transition-all animate-in slide-in-from-bottom-5 z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-indigo-500" />
                    AI Evaluation
                  </h3>
                  <Badge
                    className={
                      evaluation.rating >= 8
                        ? "bg-green-500"
                        : evaluation.rating >= 5
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }
                  >
                    Score: {evaluation.rating}/10
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                      Feedback
                    </h4>
                    <p className="text-sm">{evaluation.feedback}</p>
                  </div>

                  {evaluation.suggestions &&
                    evaluation.suggestions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                          Suggestions for Improvement
                        </h4>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {evaluation.suggestions.map(
                            (s: string, i: number) => (
                              <li key={i}>{s}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Test Cases and Console Section (Coding Only) */}
          {!isGeneral && (
            <div className="h-64 shrink-0 rounded-xl border bg-card overflow-hidden flex flex-col shadow-sm">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full flex flex-col h-full"
              >
                <div className="bg-muted px-4 py-2 border-b">
                  <TabsList className="h-8 p-0 bg-transparent">
                    <TabsTrigger
                      value="testcase"
                      className="text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Test Cases
                    </TabsTrigger>
                    <TabsTrigger
                      value="console"
                      className="text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Console
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="testcase"
                  className="flex-1 m-0 overflow-hidden"
                >
                  <div className="h-full overflow-y-auto p-4">
                    {problem.testCases &&
                      problem.testCases.filter((tc: any) => !tc.isHidden).length >
                      0 ? (
                      <div className="space-y-3">
                        {problem.testCases
                          .filter((tc: any) => !tc.isHidden)
                          .map((testCase: any, index: number) => (
                            <div
                              key={testCase.id}
                              className="text-sm border-b border-border/40 pb-3 last:border-0"
                            >
                              <div className="font-semibold text-foreground mb-2">
                                Case {index + 1}
                              </div>
                              <div className="font-mono text-xs space-y-1 pl-2">
                                <div>
                                  <span className="text-muted-foreground">
                                    Input:{" "}
                                  </span>
                                  <span className="text-blue-400">
                                    {testCase.input}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Expected:{" "}
                                  </span>
                                  <span className="text-green-400">
                                    {testCase.output}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        No test cases available
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="console"
                  className="flex-1 m-0 overflow-hidden"
                >
                  <div className="h-full overflow-y-auto p-4">
                    {isRunning ? (
                      <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Executing code...</span>
                      </div>
                    ) : error ? (
                      <div className="bg-red-950/30 border border-red-500/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="font-semibold text-red-500">
                            Error
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm text-red-300 font-mono">
                          {error}
                        </pre>
                      </div>
                    ) : mentorship ? (
                      <div className="space-y-4">
                        <div className="bg-red-950/30 border border-red-500/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="h-5 w-5 text-red-500" />
                            <span className="font-semibold text-red-500">
                              Error Analysis
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap text-sm text-red-300 font-mono mb-4">
                            {error}
                          </pre>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 shadow-sm">
                          <h4 className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300 mb-3">
                            <BrainCircuit className="h-5 w-5" /> AI Mentor
                          </h4>

                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                                <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-foreground">What happened?</h5>
                                <p className="text-sm text-muted-foreground">{mentorship.explanation}</p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                                <Wrench className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-foreground">How to fix it</h5>
                                <p className="text-sm text-muted-foreground">{mentorship.fix}</p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                                <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-foreground">Key Concept: {mentorship.conceptTitle}</h5>
                                <p className="text-sm text-muted-foreground">{mentorship.concept}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : testResults ? (
                      <div className="space-y-4">
                        {/* Status Summary */}
                        <div className="flex items-center gap-3 pb-2 border-b">
                          {(() => {
                            const passedCount = testResults.filter(
                              (t) => t.status === "Passed",
                            ).length;
                            const totalCount = testResults.length;
                            const allPassed = passedCount === totalCount;

                            return (
                              <>
                                <Badge
                                  className={
                                    allPassed
                                      ? "bg-green-600 hover:bg-green-700"
                                      : "bg-red-600 hover:bg-red-700"
                                  }
                                >
                                  {allPassed
                                    ? "Accepted"
                                    : `${passedCount}/${totalCount} test cases passed`}
                                </Badge>
                                {runtime !== null && (
                                  <span className="text-sm text-muted-foreground">
                                    Runtime: {runtime}ms
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Individual Test Results */}
                        <div className="space-y-3">
                          {testResults.map((result, index) => (
                            <Card
                              key={index}
                              className={
                                result.status === "Passed"
                                  ? "border-green-500/50 bg-green-950/10"
                                  : "border-red-500/50 bg-red-950/10"
                              }
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  {result.status === "Passed" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                  )}
                                  <span className="font-semibold">
                                    Case {index + 1}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      result.status === "Passed"
                                        ? "text-green-500 border-green-500"
                                        : "text-red-500 border-red-500"
                                    }
                                  >
                                    {result.status}
                                  </Badge>
                                </div>
                                <div className="space-y-2 text-sm font-mono ml-6">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Input ={" "}
                                    </span>
                                    <span className="text-blue-400">
                                      {result.isHidden &&
                                        result.status !== "Passed"
                                        ? "Hidden"
                                        : result.input}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Output ={" "}
                                    </span>
                                    <span
                                      className={
                                        result.status === "Passed"
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {result.isHidden &&
                                        result.status !== "Passed"
                                        ? "Hidden"
                                        : result.actual}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Expected ={" "}
                                    </span>
                                    <span className="text-green-400">
                                      {result.isHidden &&
                                        result.status !== "Passed"
                                        ? "Hidden"
                                        : result.expected}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground/50 italic text-sm h-full flex items-center justify-center">
                        Run your code to see output here...
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
