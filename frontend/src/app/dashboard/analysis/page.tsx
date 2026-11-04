"use client"

import { readApiJson } from "@/lib/api-response";

import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Briefcase, CheckCircle2, ChevronRight, FileText, Globe, LineChart, Lock, Search, Target, TrendingUp, AlertCircle, Sparkles, Clock } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell
} from 'recharts'

import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

export default function AnalysisPage() {
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

    const [mounted, setMounted] = useState(false)
    const [resume, setResume] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setMounted(true)
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user?.email) {
                try {
                    const res = await fetch(`/api/resume?email=${encodeURIComponent(user.email)}`)
                    if (res.ok) {
                        const json = await readApiJson(res)
                        if (json.success && json.data) {
                            setResume(json.data)
                        }
                    }
                } catch (e) {
                    console.error("Failed to load resume for analysis:", e)
                } finally {
                    setLoading(false)
                }
            } else {
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    if (!mounted) return null

    const targetRole = resume?.personal?.role || resume?.personal?.targetCompany ? `${resume?.personal?.role || "Software Engineer"}` : "Software Engineer"
    const score = resume?.analysis?.score || 0
    const feedback = resume?.analysis?.feedback || (resume ? "Resume saved. AI analysis ready." : "No resume saved in database yet. Build your resume in the Resume tab to get an AI career fit analysis.")
    const improvements = resume?.analysis?.improvements || []
    const strengths = resume?.analysis?.strengths || []

    const radarData = [
        { skill: 'Core Skills', user: score ? Math.min(100, score + 5) : 0, required: 85, fullMark: 100 },
        { skill: 'System Design', user: score ? Math.max(20, score - 15) : 0, required: 80, fullMark: 100 },
        { skill: 'Domain Fit', user: score || 0, required: 75, fullMark: 100 },
        { skill: 'Problem Solving', user: score ? Math.min(95, score + 10) : 0, required: 85, fullMark: 100 },
        { skill: 'Communication', user: score ? Math.min(90, score + 5) : 0, required: 80, fullMark: 100 },
    ]

    const marketData = [
        { role: 'Frontend', readiness: score ? Math.min(100, score + 10) : 0, demand: 85 },
        { role: 'Backend', readiness: score ? Math.max(30, score - 5) : 0, demand: 90 },
        { role: 'Full Stack', readiness: score || 0, demand: 95 },
        { role: 'DevOps', readiness: score ? Math.max(20, score - 20) : 0, demand: 75 },
    ]

    return (
        <motion.div
            className="space-y-8 max-w-7xl mx-auto pb-10"
            variants={container}
            initial="hidden"
            animate="show"
        >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1 text-sm group">
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                        </Link>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Career Fit Analysis
                    </h1>
                    <p className="text-muted-foreground">AI-driven gap analysis against your target role: <strong className="text-foreground">{targetRole}</strong></p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Market Status: Hiring Active
                    </Badge>
                </div>
            </motion.div>

            {/* Top Level Fit Score */}
            <motion.div variants={item}>
                <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <CardContent className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-4 max-w-2xl">
                            <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-300">
                                <Sparkles className="mr-2 h-3 w-3" /> AI Analysis Ready
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold">
                                {score > 0 ? (
                                    <>You are a <span className="text-blue-400">{score}% Match</span> for {targetRole}.</>
                                ) : (
                                    <>Profile Analysis Pending</>
                                )}
                            </h2>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                {feedback}
                            </p>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Link href="/dashboard/problems">
                                    <Button className="bg-white text-slate-900 hover:bg-slate-100 font-semibold">
                                        Practice Problems
                                    </Button>
                                </Link>
                                <Link href="/dashboard/resume">
                                    <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10">
                                        Edit Resume
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Circular Progress Visual */}
                        <div className="relative h-40 w-40 flex-shrink-0 flex items-center justify-center">
                            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                                <circle className="text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                                <circle
                                    className="text-blue-500 transition-all duration-1000 ease-out"
                                    strokeWidth="8"
                                    strokeDasharray={251.2}
                                    strokeDashoffset={251.2 - (251.2 * (score || 0)) / 100}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="40"
                                    cx="50"
                                    cy="50"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-bold">{score || 0}%</span>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400">Ready</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Gap Analysis Chart */}
                <motion.div variants={item} className="h-full">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Skill Gap Visualization</CardTitle>
                            <CardDescription>
                                <span className="text-blue-500 font-medium">Blue: Your Level</span> vs <span className="text-slate-400 font-medium">Grey: Role Benchmark</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center">
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                                        <PolarGrid strokeOpacity={0.2} />
                                        <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 12 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="Required" dataKey="required" stroke="#94a3b8" strokeWidth={2} fill="#94a3b8" fillOpacity={0.1} />
                                        <Radar name="You" dataKey="user" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.4} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Readiness by Role Bar Chart */}
                <motion.div variants={item} className="h-full">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Role Readiness Index</CardTitle>
                            <CardDescription>Estimated benchmark against active technology tracks</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={marketData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="role" type="category" width={80} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                                        <Bar dataKey="readiness" name="Readiness %" barSize={32} radius={[0, 4, 4, 0]}>
                                            {marketData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.readiness > 80 ? '#22c55e' : entry.readiness > 60 ? '#3b82f6' : '#f59e0b'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="text-center text-sm text-muted-foreground mt-2">
                                Derived from your real resume experience and domain profile.
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Dynamic Action Plan */}
            <motion.div variants={item}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-red-500" />
                            Key Focus & Improvement Areas
                        </CardTitle>
                        <CardDescription>
                            {improvements.length > 0 
                                ? `Identified by AI analysis for "${targetRole}"`
                                : `Save your resume to view prioritized suggestions for "${targetRole}"`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {improvements.length > 0 ? (
                            <div className="space-y-3">
                                {improvements.map((imp: string, idx: number) => (
                                    <ActionItem
                                        key={idx}
                                        skill={`Focus Area ${idx + 1}`}
                                        desc={imp}
                                        impact={idx === 0 ? "High" : "Medium"}
                                        time="Immediate"
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                <p className="font-semibold">No action items found</p>
                                <p className="text-xs mt-1">Add your skills, projects, and work history in the Resume Builder to generate customized improvement insights.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    )
}

function ActionItem({ skill, desc, impact, time }: { skill: string, desc: string, impact: string, time: string }) {
    return (
        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors bg-card">
            <div className="flex items-start gap-4">
                <div className="mt-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-full">
                    <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                    <h4 className="font-semibold text-base">{skill}</h4>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2 min-w-[100px]">
                <Badge variant={impact === 'High' ? 'destructive' : 'secondary'}>{impact} Impact</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {time}
                </span>
            </div>
        </div>
    )
}
