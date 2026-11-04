"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Briefcase, MapPin, DollarSign, Building2, Search, Filter, CheckCircle2, XCircle, Loader2, FileText, Download, Play, Radio, Sparkles } from "lucide-react"

import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { readApiJson } from "@/lib/api-response"

export default function JobsPage() {
    const [jobs, setJobs] = useState<any[]>([])
    const [isLoadingJobs, setIsLoadingJobs] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [appliedMap, setAppliedMap] = useState<Record<string, any>>({})
    const [applyingJobId, setApplyingJobId] = useState<string | null>(null)
    const [searchMode, setSearchMode] = useState<"text" | "resume">("text")
    const [semanticResults, setSemanticResults] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState("")
    const [searchNotice, setSearchNotice] = useState("")

    const fetchJobs = async () => {
        try {
            const res = await fetch("/api/jobs")
            const data = await readApiJson(res)
            if (!Array.isArray(data)) return

            const seenIds = new Set<string>()
            const uniqueJobs = data.filter((job: any) => {
                const id = String(job.id || job._id || "")
                if (!id || seenIds.has(id)) return false
                seenIds.add(id)
                return true
            })

            const enrichedData = uniqueJobs.map((job: any, i: number) => {
                const skills = Array.isArray(job.skillsRequired)
                    ? job.skillsRequired
                    : typeof job.skillsRequired === "string"
                        ? job.skillsRequired.split(",").map((item: string) => item.trim()).filter(Boolean)
                        : ["Active"]

                return {
                    ...job,
                    id: String(job.id || job._id),
                    title: job.roleRequired || job.title,
                    company: job.company || "Company",
                    logo: job.logo || (job.company || "M").substring(0, 2).toUpperCase(),
                    color: job.color || ["bg-blue-600", "bg-purple-600", "bg-indigo-600", "bg-pink-600", "bg-emerald-600"][i % 5],
                    tags: job.tags || skills.slice(0, 5)
                }
            })
            setJobs(enrichedData)
        } catch (error) {
            console.error("Failed to fetch jobs:", error)
        } finally {
            setIsLoadingJobs(false)
        }
    }

    useEffect(() => {
        fetchJobs()
    }, [])

    const handleSearch = async () => {
        if (searchMode === "text" && searchQuery.trim().length < 2) return
        setIsSearching(true)
        setSearchError("")
        setSearchNotice("")
        try {
            let query = searchQuery.trim()
            if (searchMode === "resume") {
                const user = auth.currentUser
                if (!user) throw new Error("Log in to search jobs using your resume.")
                const params = new URLSearchParams()
                if (user.email) params.set("email", user.email)
                params.set("uid", user.uid)
                const resumeResponse = await fetch(`/api/resume?${params.toString()}`)
                const resumeResult = await readApiJson(resumeResponse)
                const resume = resumeResult?.data
                if (!resume) throw new Error("Save your resume before searching by resume.")
                query = JSON.stringify(resume).slice(0, 1800)
            }
            const response = await fetch("/api/jobs/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, limit: 30 })
            })
            const data = await readApiJson(response)
            setSemanticResults(true)
            setSearchNotice("")
            setJobs(Array.isArray(data) ? data.map((job: any, i: number) => ({
                ...job,
                id: String(job.id || job._id),
                title: job.roleRequired || job.title,
                company: job.company || "Company",
                logo: job.logo || (job.company || "M").substring(0, 2).toUpperCase(),
                color: job.color || ["bg-blue-600", "bg-purple-600", "bg-indigo-600", "bg-pink-600", "bg-emerald-600"][i % 5],
                tags: job.tags || (Array.isArray(job.skillsRequired) ? job.skillsRequired : [])
            })) : [])
        } catch (error: any) {
            setSearchError(error.message || "Job search failed.")
        } finally {
            setIsSearching(false)
        }
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const res = await fetch(`/api/applications/user/${user.uid}`)
                    if (res.ok) {
                        const apps = await readApiJson(res)
                        const map: Record<string, any> = {}
                        apps.forEach((app: any) => {
                            const jId = String(app.jobId?.$oid || app.jobId)
                            map[jId] = app
                        })
                        setAppliedMap(map)
                    }
                } catch (e) {
                    console.error("Failed to load user applications", e)
                }
            }
        })
        return () => unsubscribe()
    }, [])

    // Instant Apply without questions or modal prompts
    const handleApply = async (job: any) => {
        const user = auth.currentUser
        if (!user) {
            alert("Please log in to apply")
            return
        }

        setApplyingJobId(job.id)

        try {
            const res = await fetch("/api/applications/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobId: job.id,
                    applicantUid: user.uid,
                    applicantName: user.displayName || user.email?.split("@")[0] || "Candidate",
                    applicantEmail: user.email || ""
                })
            })

            if (res.ok) {
                const app = await readApiJson(res)
                setAppliedMap((prev) => ({
                    ...prev,
                    [job.id]: app
                }))
            } else {
                const err = await readApiJson(res)
                alert(err.detail || err.error || "Failed to apply")
            }
        } catch (error) {
            console.error("Application error:", error)
            alert("An error occurred while applying.")
        } finally {
            setApplyingJobId(null)
        }
    }

    const handleGiveInterview = (job: any, applicationId?: string) => {
        const user = auth.currentUser
        const email = encodeURIComponent(user?.email || "")
        const uid = encodeURIComponent(user?.uid || "")
        const appId = encodeURIComponent(applicationId || "")
        const jobId = encodeURIComponent(job.id)

        // Launch the Momentum interview directly
        window.location.href = `http://localhost:8000/?jobId=${jobId}&candidateEmail=${email}&candidateId=${uid}&applicationId=${appId}`
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                        Discover Opportunities
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Browse active job listings, apply instantly, and start your AI interview.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select aria-label="Job search mode" value={searchMode} onChange={(e) => { setSearchMode(e.target.value as "text" | "resume"); setSemanticResults(false) }} className="h-10 rounded-xl border bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="text">Skills, title, or keyword</option>
                        <option value="resume">Search by my resume</option>
                    </select>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search jobs, skills, or companies..."
                            disabled={searchMode === "resume"}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSemanticResults(false) }}
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={isSearching || (searchMode === "text" && searchQuery.trim().length < 2)} className="rounded-xl shrink-0">
                        {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Search
                    </Button>
                </div>
            </div>

            {searchError && <p role="alert" className="text-sm text-red-600">{searchError}</p>}
            {searchNotice && <p role="status" className="text-sm text-amber-700">{searchNotice}</p>}

            <div className="grid gap-6">
                {isLoadingJobs ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
                    ))
                ) : semanticResults ? jobs.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed"><p className="text-muted-foreground">No relevant jobs found.</p></div>
                ) : jobs.map((job, idx) => {
                        const application = appliedMap[job.id]
                        const isApplied = Boolean(application)
                        const isCompleted = application?.status === "Completed" || application?.status === "Hired" || (application?.matchScore && application.matchScore > 0)
                        const isHired = application?.status === "Hired" || application?.isHired === true
                        const isCurrentApplying = applyingJobId === job.id
                        return (
                            <Card key={`${job.id}-${idx}`} className="group overflow-hidden border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4">
                                    <div className="flex items-center gap-4"><div className={`h-14 w-14 rounded-2xl ${job.color} flex items-center justify-center text-white font-bold text-xl`}>{job.logo}</div><div><CardTitle>{job.title}</CardTitle><div className="text-muted-foreground">{job.company} · {job.location || "Remote"}</div></div></div>
                                    <div>{isApplied ? <Button onClick={() => handleGiveInterview(job, application?.id || application?._id)} variant="outline">{isCompleted ? (isHired ? "Hired" : "Completed") : "Give Interview"}</Button> : <Button onClick={() => handleApply(job)} disabled={isCurrentApplying}>{isCurrentApplying ? "Applying..." : "Apply Now"}</Button>}</div>
                                </CardHeader>
                                <CardContent><div className="flex flex-wrap gap-2">{job.tags?.map((tag: string, index: number) => <Badge key={`${tag}-${index}`} variant="outline">{tag}</Badge>)}</div><p className="mt-4 text-sm text-muted-foreground">{job.description}</p></CardContent>
                            </Card>
                        )
                    }) : jobs.filter(job =>
                    (job.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (job.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (job.tags && job.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())))
                ).length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
                        <p className="text-muted-foreground">No jobs found matching your search.</p>
                    </div>
                ) : (
                    jobs.filter(job =>
                        (job.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (job.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (job.tags && job.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())))
                    ).map((job, idx) => {
                        const application = appliedMap[job.id]
                        const isApplied = Boolean(application)
                        const isCompleted = application?.status === "Completed" || application?.status === "Hired" || (application?.matchScore && application.matchScore > 0)
                        const isHired = application?.status === "Hired" || application?.isHired === true
                        const isCurrentApplying = applyingJobId === job.id

                        return (
                            <Card key={`${job.id || job._id || 'job'}-${idx}`} className="group overflow-hidden border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-14 w-14 rounded-2xl ${job.color} flex items-center justify-center text-white font-bold text-xl shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                                            {job.logo}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">{job.title}</CardTitle>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-md font-medium">{job.type || "Full-time"}</Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-muted-foreground font-medium">
                                                <div className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {job.company}</div>
                                                <span className="text-slate-300">•</span>
                                                <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {job.location || "Remote"}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {isApplied ? (
                                            <div className="flex items-center gap-2">
                                                {isCompleted ? (
                                                    isHired ? (
                                                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 py-2 px-4 rounded-full flex items-center gap-1.5 font-bold shadow-sm text-sm">
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            Hired 🎉
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 py-2 px-4 rounded-full flex items-center gap-1.5 font-bold shadow-sm text-sm">
                                                            <XCircle className="h-4 w-4 text-slate-500" />
                                                            Not Hired
                                                        </Badge>
                                                    )
                                                ) : (
                                                    <>
                                                        <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/20 py-2 px-3 rounded-full flex gap-1.5 font-semibold">
                                                            <CheckCircle2 className="h-4 w-4" /> Applied
                                                        </Badge>
                                                        <Button
                                                            onClick={() => handleGiveInterview(job, application?.id || application?._id)}
                                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full px-6 py-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                                                        >
                                                            <Play className="h-4 w-4 fill-white" />
                                                            Give Interview
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={() => handleApply(job)}
                                                disabled={isCurrentApplying}
                                                className="bg-slate-900 hover:bg-primary text-white dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-primary dark:hover:text-white rounded-full px-7 py-2.5 transition-all shadow-md active:scale-95 font-semibold"
                                            >
                                                {isCurrentApplying ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Applying...
                                                    </>
                                                ) : (
                                                    "Apply Now"
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4" />
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {job.tags && job.tags.map((tag: string, tIdx: number) => (
                                                <Badge key={`${tag}-${tIdx}`} variant="outline" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-normal">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>

                                        {(job.experience || job.qualification || job.employeeQualities) && (
                                            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                                                {job.experience && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Experience</span>{job.experience}</div>}
                                                {job.qualification && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Qualification</span>{job.qualification}</div>}
                                                {job.employeeQualities && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Qualities</span>{job.employeeQualities}</div>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-5 flex items-center justify-between gap-4">
                                        <div className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{job.description}</div>
                                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-lg whitespace-nowrap">
                                            <DollarSign className="h-5 w-5 text-emerald-500" />
                                            {job.salary}
                                        </div>
                                    </div>
                                    {job.roleDocument?.data && (
                                        <a
                                            href={job.roleDocument.data}
                                            download={job.roleDocument.name || "role-document.pdf"}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                                        >
                                            <FileText className="h-4 w-4" />
                                            View role PDF
                                            <Download className="h-4 w-4" />
                                        </a>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
