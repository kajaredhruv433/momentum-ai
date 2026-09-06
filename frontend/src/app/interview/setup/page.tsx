"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mic, Camera, BrainCircuit, ArrowLeft } from "lucide-react"
import Link from "next/link"

function InterviewSetupContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [topic, setTopic] = useState("")
    const [difficulty, setDifficulty] = useState("Medium")

    useEffect(() => {
        const queryTopic = searchParams.get("topic")
        const queryDifficulty = searchParams.get("difficulty")
        if (queryTopic) setTopic(queryTopic)
        if (queryDifficulty) setDifficulty(queryDifficulty)
    }, [searchParams])

    const handleStart = async () => {
        if (!topic) return;
        setLoading(true);

        // Passing params to room to fetch there allows for refresh handling
        router.push(`/interview/room?topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(difficulty)}`);
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md mb-4">
                <Link
                    href="/dashboard/interviews"
                    className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Interviews
                </Link>
            </div>
            <Card className="w-full max-w-md border-none shadow-2xl bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                        <BrainCircuit className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-2xl font-black tracking-tight">AI Technical Interview</CardTitle>
                    <CardDescription>
                        Configure your session. Our AI will challenge you with domain-specific questions while monitoring your environment.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="topic">Interview Topic</Label>
                        <Input
                            id="topic"
                            placeholder="e.g. React.js, Python, System Design"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="h-11 border-dashed"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="difficulty">Difficulty Level</Label>
                        <select
                            id="difficulty"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="Easy">Entry Level (Easy)</option>
                            <option value="Medium">Mid-Senior (Medium)</option>
                            <option value="Hard">Senior / Expert (Hard)</option>
                            <option value="Tricky">Tricky & Conceptual</option>
                        </select>
                    </div>

                    <div className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl">
                            <div className="flex items-center gap-2">
                                <Camera className="h-4 w-4 text-blue-500" />
                                <span>Camera On</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mic className="h-4 w-4 text-blue-500" />
                                <span>Microphone On</span>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                            onClick={handleStart}
                            disabled={!topic || loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing...
                                </>
                            ) : (
                                "Start Interview Session"
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function InterviewSetupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        }>
            <InterviewSetupContent />
        </Suspense>
    )
}
