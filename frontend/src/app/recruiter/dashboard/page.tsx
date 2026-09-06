"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Briefcase, Calendar, FileText, ArrowUpRight, Clock, Zap, PlusCircle } from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
}

export default function RecruiterHome() {
    const [userName, setUserName] = useState("Recruiter")
    const [companyName, setCompanyName] = useState<string | null>(null)
    const [stats, setStats] = useState({
        activeJobs: 0,
        totalApplicants: 0,
        pendingReview: 0,
        shortlisted: 0
    })
    const [recentApplicants, setRecentApplicants] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async (user: any) => {
            setLoading(true)
            try {
                // Fetch Profile
                const profileRes = await fetch('/api/users/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: user.uid }),
                })
                if (profileRes.ok) {
                    const profileData = await profileRes.json()
                    if (profileData.name) setUserName(profileData.name)
                    if (profileData.companyName) setCompanyName(profileData.companyName)
                }

                // Fetch Jobs (for Active Jobs count)
                const jobsRes = await fetch(`/api/jobs?recruiterUid=${user.uid}`)
                const jobsData = await jobsRes.json()

                // Fetch Applicants
                const applicantsRes = await fetch('/api/recruiter/applicants', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recruiterUid: user.uid })
                })
                const applicantsData = await applicantsRes.json()

                // Fetch Interviewed candidates (sorted descending by match score)
                let interviewedData: any[] = []
                try {
                    const interviewedRes = await fetch('/api/recruiter/interviewed-candidates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recruiterUid: user.uid })
                    })
                    if (interviewedRes.ok) {
                        interviewedData = await interviewedRes.json()
                    }
                } catch (e) {}

                const pending = applicantsData.filter((a: any) => a.status === 'Applied' || a.status === 'Screening').length
                const shortlistedCount = applicantsData.filter((a: any) => a.status === 'Shortlisted' || a.status === 'Completed').length

                setStats({
                    activeJobs: jobsData.length,
                    totalApplicants: applicantsData.length,
                    pendingReview: pending,
                    shortlisted: shortlistedCount
                })

                // Prioritize top interviewed candidates, fallback to applicants
                if (interviewedData.length > 0) {
                    setRecentApplicants(interviewedData.slice(0, 3))
                } else {
                    setRecentApplicants(applicantsData.slice(0, 3))
                }

            } catch (error) {
                console.error("Dashboard Fetch Error:", error)
            } finally {
                setLoading(false)
            }
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchData(user)
            } else {
                setLoading(false)
            }
        })
        return () => unsubscribe()
    }, [])

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8 pb-10"
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            Welcome back, {userName}
                        </h1>
                        {companyName && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {companyName}
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-lg mt-1">
                        Here's what's happening with your recruitment pipeline today.
                    </p>
                </div>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" asChild>
                    <Link href="/recruiter/dashboard/jobs/new">
                        <PlusCircle className="mr-2 h-5 w-5" /> Post New Job
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Active Jobs"
                    value={stats.activeJobs.toString()}
                    href="/recruiter/dashboard/jobs"
                    icon={<Briefcase className="h-5 w-5 text-blue-500" />}
                    trend="+1 this week"
                />
                <MetricCard
                    title="Total Applicants"
                    value={stats.totalApplicants.toString()}
                    href="/recruiter/dashboard/candidates"
                    icon={<Users className="h-5 w-5 text-purple-500" />}
                    trend="+4 today"
                />
                <MetricCard
                    title="Pending Review"
                    value={stats.pendingReview.toString()}
                    href="/recruiter/dashboard/candidates"
                    icon={<FileText className="h-5 w-5 text-amber-500" />}
                    trend="Requires Action"
                />
                <MetricCard
                    title="Shortlisted"
                    value={stats.shortlisted.toString()}
                    href="/recruiter/dashboard/candidates"
                    icon={<Users className="h-5 w-5 text-emerald-500" />}
                    trend="Pipeline Active"
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-none shadow-xl bg-gradient-to-b from-background to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Recent Applicants</CardTitle>
                            <CardDescription>AI-ranked candidates for your open roles.</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/recruiter/dashboard/candidates" className="text-blue-500 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20">View All</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                                    ))}
                                </div>
                            ) : recentApplicants.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="h-10 w-10 mx-auto opacity-30 mb-2" />
                                    <p className="font-semibold">No applicants yet</p>
                                    <p className="text-xs">Post a job to begin receiving AI-ranked candidate profiles.</p>
                                </div>
                            ) : (
                                recentApplicants.map((candidate) => (
                                    <motion.div
                                        key={candidate.id}
                                        variants={item}
                                        className="flex items-center justify-between p-3 rounded-2xl bg-card border transition-all hover:border-blue-500/30 hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold">
                                                {candidate.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm leading-none">{candidate.name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{candidate.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full inline-block">
                                                    {candidate.matchScore}% Match
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{candidate.experience}</p>
                                            </div>
                                            <Button variant="outline" size="sm" className="rounded-full px-4 hover:bg-blue-600 hover:text-white transition-all shadow-sm" asChild>
                                                <Link href={`/recruiter/dashboard/candidates/view/${candidate.id}`}>Review</Link>
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 border-none shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Hiring Pipeline</CardTitle>
                        <CardDescription>Status breakdown of your active applicants.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-xs">
                                        AP
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Newly Applied</p>
                                        <p className="text-xs text-muted-foreground">Awaiting initial review</p>
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-blue-600">{stats.pendingReview}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-purple-500/20 text-purple-600 flex items-center justify-center font-bold text-xs">
                                        SL
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Shortlisted Candidates</p>
                                        <p className="text-xs text-muted-foreground">Qualified for next steps</p>
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-purple-600">{stats.shortlisted}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                        JB
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Active Job Openings</p>
                                        <p className="text-xs text-muted-foreground">Currently accepting applications</p>
                                    </div>
                                </div>
                                <span className="font-bold text-lg text-emerald-600">{stats.activeJobs}</span>
                            </div>
                        </div>

                        <div className="pt-2 border-t flex flex-col gap-2">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold" asChild>
                                <Link href="/recruiter/dashboard/candidates">Review Candidates</Link>
                            </Button>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href="/recruiter/dashboard/jobs/new">Post Another Job</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    )
}

function MetricCard({ title, value, icon, href, trend }: any) {
    return (
        <motion.div variants={item}>
            <Link href={href}>
                <Card className={`overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1 border-none bg-gradient-to-br from-background to-muted/30 dark:to-muted/10 group`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">{title}</CardTitle>
                        <div className={`p-2 rounded-lg bg-background shadow-sm group-hover:scale-110 transition-transform`}>
                            {icon}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between">
                            <div className="text-4xl font-black tracking-tighter">{value}</div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground mb-1">
                                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                {trend}
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "70%" }}
                                transition={{ duration: 1, delay: 0.5 }}
                                className={`h-full bg-blue-600 rounded-full`}
                            />
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </motion.div>
    )
}
