import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react"

export default function InterviewReport() {
    return (
        <div className="container py-10 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Interview Analysis Report</h1>
                <p className="text-muted-foreground">Session ID: #8294 • System Design • 45 mins</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Overall Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-primary">8.5/10</div>
                        <p className="text-sm text-green-600 mt-1">Top 15% of candidates</p>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                    <ScoreCard label="Technical" score="9/10" />
                    <ScoreCard label="Communication" score="7/10" />
                    <ScoreCard label="Confidence" score="8/10" />
                </div>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>AI Feedback Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FeedbackItem type="positive" text="Excellent understanding of distributed caching mechanisms." />
                        <FeedbackItem type="positive" text="Structured approach to the problem solving (STAR method observed)." />
                        <FeedbackItem type="improve" text="Could improve explanation of database sharding strategies." />
                        <FeedbackItem type="improve" text="Pacing was slightly fast in the beginning." />
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button variant="outline" asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
                    <Button>Download Full PDF</Button>
                </div>
            </div>
        </div>
    )
}

function ScoreCard({ label, score }: { label: string, score: string }) {
    return (
        <Card>
            <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold">{score}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
        </Card>
    )
}

function FeedbackItem({ type, text }: { type: "positive" | "improve", text: string }) {
    return (
        <div className="flex gap-3 items-start">
            {type === "positive" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            )}
            <p className="text-sm">{text}</p>
        </div>
    )
}
