"use client"

import { readApiJson } from "@/lib/api-response";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, PlayCircle, Radio, Sparkles, TrendingUp, Trophy, Video, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

import { useState, useEffect } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

export default function DashboardHome() {
    const [userName, setUserName] = useState<string>("Candidate")
    const [activeInterviews, setActiveInterviews] = useState<number>(0)
    const [completedInterviews, setCompletedInterviews] = useState<number>(0)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (user.displayName) {
                    setUserName(user.displayName.split(" ")[0])
                } else if (user.email) {
                    setUserName(user.email.split("@")[0])
                }

                try {
                    const res = await fetch(
                        `/api/candidate/interviews?applicantUid=${user.uid}&applicantEmail=${encodeURIComponent(user.email || "")}`
                    )
                    if (res.ok) {
                        const data = await readApiJson(res)
                        setActiveInterviews((data.queue || []).length)
                        setCompletedInterviews((data.completed || []).length)
                    }
                } catch (e) {
                    console.error("Failed to load interview stats", e)
                }
            }
        })
        return () => unsubscribe()
    }, [])

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    }

    return (
        <motion.div
            className="space-y-8 max-w-7xl mx-auto"
            variants={container}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                        Welcome back, {userName}!
                    </h1>
                    <p className="text-muted-foreground text-lg mt-1">
                        Apply to open roles and take multi-panel AI voice interviews powered by Momentum.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/jobs">
                        <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold shadow-md">
                            <Briefcase className="h-4 w-4" />
                            Explore Opportunities
                        </Button>
                    </Link>
                </div>
            </motion.div>

            {/* Main Action Banner */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <motion.div variants={item} className="col-span-4">
                    <Card className="h-full border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-lg relative overflow-hidden group">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Radio className="h-5 w-5 text-emerald-500 animate-pulse" />
                                    <CardTitle>Momentum AI Voice Interviews</CardTitle>
                                </div>
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold">
                                    Live Multi-Panel
                                </Badge>
                            </div>
                            <CardDescription className="text-base">
                                Real-time voice interaction with specialized technical interviewers
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold">Immediate Interview Access</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    Whenever you apply for a job on Momentum, you can immediately start your technical assessment. Your resume and job requirements are automatically loaded into the interview room.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Link href="/dashboard/interviews">
                                    <Button size="lg" className="shadow-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all hover:-translate-y-0.5">
                                        <PlayCircle className="mr-2 h-5 w-5" />
                                        Go to Interview Queue ({activeInterviews})
                                    </Button>
                                </Link>
                                <Link href="/dashboard/jobs">
                                    <Button variant="secondary" size="lg" className="shadow-sm">
                                        Browse Jobs
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item} className="col-span-3">
                    <Card className="h-full shadow-md border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-emerald-500" />
                                Interview Activity
                            </CardTitle>
                            <CardDescription>Your assessment progression</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl bg-muted/30 p-4 border border-border/40">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-muted-foreground">Pending Interviews</span>
                                    <span className="text-2xl font-black text-emerald-500">{activeInterviews}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Ready to start at any time</p>
                            </div>

                            <div className="rounded-xl bg-muted/30 p-4 border border-border/40">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-muted-foreground">Completed Evaluations</span>
                                    <span className="text-2xl font-black text-blue-500">{completedInterviews}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Submitted to recruiter dashboards</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                <motion.div variants={item}>
                    <Link href="/dashboard/jobs">
                        <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group">
                            <CardHeader className="pb-2">
                                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                                    <Briefcase className="h-6 w-6" />
                                </div>
                                <CardTitle>Find Jobs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Explore verified job openings from top employers, apply instantly with one click, and take your interview.
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </motion.div>

                <motion.div variants={item}>
                    <Link href="/dashboard/interviews">
                        <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group">
                            <CardHeader className="pb-2">
                                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
                                    <Video className="h-6 w-6" />
                                </div>
                                <CardTitle>Interview Queue</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Track applied roles waiting for assessment and review your detailed evaluation reports with match percentages.
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </motion.div>

                <motion.div variants={item}>
                    <Link href="/dashboard/resume">
                        <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group">
                            <CardHeader className="pb-2">
                                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-2 group-hover:scale-110 transition-transform">
                                    <Trophy className="h-6 w-6" />
                                </div>
                                <CardTitle>Resume Profile</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Keep your education, work experience, and core skills up to date so interviewers can reference them during assessments.
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </motion.div>
            </div>
        </motion.div>
    )
}
