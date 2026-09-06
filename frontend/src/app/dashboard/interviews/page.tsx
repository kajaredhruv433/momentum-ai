"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Video,
    Calendar,
    Clock,
    ArrowRight,
    PlayCircle,
    CheckCircle2,
    Briefcase,
    Building2,
    MapPin,
    DollarSign,
    Loader2,
    Sparkles,
    ShieldCheck,
    FileText,
    TrendingUp,
    X
} from "lucide-react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, User } from "firebase/auth"

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
}

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
}

interface InterviewQueueItem {
    applicationId: string;
    jobId: string | null;
    jobTitle: string;
    company: string;
    location: string;
    salary: string;
    jobType: string;
    status: string;
    topic: string;
    skillsRequired: string[];
    appliedAt: string;
    score: number;
    matchScore: number;
}

interface CompletedInterviewItem {
    sessionId: string;
    applicationId: string;
    jobId: string;
    topic: string;
    company: string;
    date: string;
    score: number;
    matchScore: number;
    technical_score: number;
    communication_score: number;
    problem_solving_score: number;
    recommendation: string;
    feedback: string;
    report?: any;
}

export default function CandidateInterviewsPage() {
    const [queue, setQueue] = useState<InterviewQueueItem[]>([])
    const [completed, setCompleted] = useState<CompletedInterviewItem[]>([])
    const [totalApplied, setTotalApplied] = useState(0)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)
    const [selectedReport, setSelectedReport] = useState<CompletedInterviewItem | null>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser)
                try {
                    const res = await fetch(
                        `/api/candidate/interviews?applicantUid=${currentUser.uid}&applicantEmail=${encodeURIComponent(currentUser.email || "")}`
                    )
                    if (res.ok) {
                        const data = await res.json()
                        setQueue(data.queue || [])
                        setCompleted(data.completed || [])
                        setTotalApplied(data.totalApplied || 0)
                    }
                } catch (err) {
                    console.error("Failed to load interview queue:", err)
                } finally {
                    setLoading(false)
                }
            } else {
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [])

    const handleStartInterview = (jobId?: string | null, applicationId?: string) => {
        const email = encodeURIComponent(user?.email || "")
        const uid = encodeURIComponent(user?.uid || "")
        const jId = encodeURIComponent(jobId || "")
        const appId = encodeURIComponent(applicationId || "")
        window.location.href = `http://localhost:8000/?jobId=${jId}&candidateEmail=${email}&candidateId=${uid}&applicationId=${appId}`
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8 max-w-6xl mx-auto pb-12"
        >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                        Interview Queue
                    </h1>
                    <p className="text-muted-foreground text-lg mt-1">
                        Active interviews ready to give and completed evaluations for your applied roles.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/jobs">
                        <Button variant="outline" className="font-semibold">
                            <Briefcase className="mr-2 h-4 w-4" /> Browse Jobs
                        </Button>
                    </Link>
                </div>
            </motion.div>

            {/* Queue Metrics */}
            <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Ready to Interview</CardTitle>
                        <Video className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{queue.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {queue.length === 1 ? "1 interview waiting to start" : `${queue.length} interviews waiting to start`}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total Applied</CardTitle>
                        <Briefcase className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold">{totalApplied}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total submitted job applications</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Completed Rounds</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold">{completed.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Evaluations saved to MongoDB</p>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Active Interview Queue */}
            <motion.div variants={item} className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Active Interview Queue</h2>
                        <p className="text-muted-foreground text-sm">
                            Click "Give Interview" to immediately start the multi-panel AI interview.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : queue.length === 0 ? (
                    <Card className="border-dashed border-2 p-12 text-center bg-card/40">
                        <div className="max-w-md mx-auto space-y-4">
                            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                                <Video className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">No Pending Interviews</h3>
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                    When you apply for a job, it instantly appears here so you can give your interview without delay.
                                </p>
                            </div>
                            <div className="pt-2">
                                <Link href="/dashboard/jobs">
                                    <Button className="font-bold shadow-md bg-primary hover:bg-primary/90">
                                        Explore Open Roles & Apply <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {queue.map((interview) => (
                            <Card
                                key={interview.applicationId}
                                className="border-2 border-emerald-500/20 bg-gradient-to-br from-card via-background to-emerald-500/5 shadow-lg overflow-hidden hover:border-emerald-500/40 transition-all duration-300"
                            >
                                <div className="p-6">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div className="space-y-3 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                                    Ready to Take
                                                </Badge>
                                                <span className="text-xs text-muted-foreground flex items-center">
                                                    Applied on {new Date(interview.appliedAt).toLocaleDateString()}
                                                </span>
                                            </div>

                                            <div>
                                                <h3 className="text-2xl font-black tracking-tight">{interview.jobTitle}</h3>
                                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                                        <Building2 className="h-4 w-4 text-muted-foreground" /> {interview.company}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-4 w-4" /> {interview.location}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="h-4 w-4" /> {interview.salary}
                                                    </span>
                                                </div>
                                            </div>

                                            {interview.skillsRequired && interview.skillsRequired.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {interview.skillsRequired.slice(0, 6).map((skill, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="text-[11px] bg-secondary px-2.5 py-0.5 rounded-full font-medium text-secondary-foreground"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="lg:w-60 flex flex-col justify-center items-stretch gap-3 border-t lg:border-t-0 lg:border-l lg:pl-6 pt-4 lg:pt-0">
                                            <Button
                                                size="lg"
                                                onClick={() => handleStartInterview(interview.jobId, interview.applicationId)}
                                                className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                            >
                                                <PlayCircle className="mr-2 h-5 w-5" />
                                                Give Interview
                                            </Button>
                                            <p className="text-[11px] text-center text-muted-foreground leading-tight">
                                                EchoSphere v9 Voice AI assessment with live interviewer speech.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Completed Job Interviews & Reports */}
            {completed.length > 0 && (
                <motion.div variants={item} className="space-y-4 pt-4 border-t">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Completed Interview Reports</h2>
                        <p className="text-muted-foreground text-sm">
                            Results and match scores from your completed interviews.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {completed.map((item) => (
                            <Card
                                key={item.sessionId}
                                className="h-full hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                                onClick={() => setSelectedReport(item)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <Badge variant="outline" className="capitalize font-bold border-emerald-500/30 text-emerald-400">
                                            {item.recommendation || "Completed"}
                                        </Badge>
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <Clock className="mr-1 h-3 w-3" />
                                            {new Date(item.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-bold line-clamp-1 group-hover:text-primary transition-colors">
                                        {item.topic}
                                    </CardTitle>
                                    <CardDescription>{item.company}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-end justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">
                                            Role Match Score
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-emerald-500">
                                                {item.matchScore || item.score}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2 text-center text-xs">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground font-medium">Technical</div>
                                            <div className="font-bold text-sm text-foreground">{item.technical_score || 0}%</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground font-medium">Communication</div>
                                            <div className="font-bold text-sm text-foreground">{item.communication_score || 0}%</div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                                        "{item.feedback}"
                                    </p>

                                    <Button variant="outline" size="sm" className="w-full text-xs font-bold">
                                        View Full Report <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Report Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setSelectedReport(null)} />
                    <Card className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-primary/20 bg-background">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                            <div>
                                <CardTitle className="text-2xl font-bold">{selectedReport.topic}</CardTitle>
                                <CardDescription>{selectedReport.company} • Completed Assessment</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedReport(null)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                    <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Role Match</div>
                                    <div className="text-3xl font-extrabold text-emerald-500 mt-1">{selectedReport.matchScore || selectedReport.score}%</div>
                                </div>
                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">Technical</div>
                                    <div className="text-3xl font-extrabold text-blue-500 mt-1">{selectedReport.technical_score || 0}%</div>
                                </div>
                                <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
                                    <div className="text-xs text-purple-400 font-bold uppercase tracking-wider">Communication</div>
                                    <div className="text-3xl font-extrabold text-purple-500 mt-1">{selectedReport.communication_score || 0}%</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Final Recommendation</h4>
                                <div className="rounded-xl bg-muted/40 p-4 text-sm font-semibold">
                                    {selectedReport.recommendation || selectedReport.feedback}
                                </div>
                            </div>

                            {selectedReport.report?.strengths && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Key Strengths</h4>
                                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                        {(Array.isArray(selectedReport.report.strengths) ? selectedReport.report.strengths : [selectedReport.report.strengths]).map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedReport.report?.areas_for_improvement && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">Areas for Improvement</h4>
                                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                        {(Array.isArray(selectedReport.report.areas_for_improvement) ? selectedReport.report.areas_for_improvement : [selectedReport.report.areas_for_improvement]).map((a: string, i: number) => (
                                            <li key={i}>{a}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end">
                                <Button onClick={() => setSelectedReport(null)} className="font-bold">
                                    Close Report
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </motion.div>
    )
}
