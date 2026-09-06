"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, User, Mail, Calendar, Loader2, Sparkles, Trophy, Award, CheckCircle2, ChevronRight, X, FileText, BarChart2, UserCheck, CheckSquare, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from "firebase/auth"

const item = {
    hidden: { y: 10, opacity: 0 },
    show: { y: 0, opacity: 1 }
}

export default function CandidatesPage() {
    const [interviewedCandidates, setInterviewedCandidates] = useState<any[]>([])
    const [allApplicants, setAllApplicants] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [topNInput, setTopNInput] = useState<number>(3)
    const [hiringLoading, setHiringLoading] = useState(false)
    const [hiredMessage, setHiredMessage] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async (user: any) => {
            setLoading(true)
            try {
                // Fetch interviewed candidates arranged in descending order of match score
                const interviewedRes = await fetch('/api/recruiter/interviewed-candidates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recruiterUid: user.uid })
                })

                if (interviewedRes.ok) {
                    const interviewed = await interviewedRes.json()
                    setInterviewedCandidates(interviewed)
                }

                // Fetch all applicants for pipeline view
                const applicantsRes = await fetch('/api/recruiter/applicants', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recruiterUid: user.uid })
                })

                if (applicantsRes.ok) {
                    const applicants = await applicantsRes.json()
                    setAllApplicants(applicants)
                }
            } catch (error) {
                console.error("Error loading candidates:", error)
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

    const filteredInterviewed = interviewedCandidates.filter(c =>
        (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.role || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    const pendingApplicants = allApplicants.filter(c => 
        !interviewedCandidates.some(ic => ic.applicationId === c.applicationId || ic.id === c.id)
    ).filter(c =>
        (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.role || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    const topMatch = interviewedCandidates.length > 0 ? interviewedCandidates[0].matchScore : 0
    const avgMatch = interviewedCandidates.length > 0
        ? Math.round(interviewedCandidates.reduce((acc, c) => acc + (c.matchScore || 0), 0) / interviewedCandidates.length)
        : 0
    const hiredCount = interviewedCandidates.filter(c => c.isHired || c.status === 'Hired').length

    // Selection handlers
    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const handleSelectAll = () => {
        const unhired = filteredInterviewed.filter(c => !c.isHired && c.status !== 'Hired')
        if (selectedIds.length === unhired.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(unhired.map(c => c.applicationId || c.id))
        }
    }

    // Single candidate hire
    const handleHireSingle = async (candidate: any) => {
        const appId = candidate.applicationId || candidate.id
        setHiringLoading(true)
        try {
            const user = auth.currentUser
            const res = await fetch('/api/recruiter/hire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId: appId,
                    recruiterUid: user?.uid
                })
            })

            if (res.ok) {
                setInterviewedCandidates(prev => prev.map(c => 
                    (c.applicationId === appId || c.id === appId) ? { ...c, isHired: true, status: 'Hired' } : c
                ))
                setAllApplicants(prev => prev.map(c => 
                    (c.applicationId === appId || c.id === appId) ? { ...c, isHired: true, status: 'Hired' } : c
                ))
                if (selectedCandidate && (selectedCandidate.applicationId === appId || selectedCandidate.id === appId)) {
                    setSelectedCandidate((prev: any) => prev ? { ...prev, isHired: true, status: 'Hired' } : null)
                }
                setSelectedIds(prev => prev.filter(x => x !== appId))
                setHiredMessage(`Successfully hired ${candidate.name}! 🎉`)
                setTimeout(() => setHiredMessage(null), 5000)
            } else {
                const err = await res.json()
                alert(err.detail || "Failed to hire candidate")
            }
        } catch (e) {
            console.error("Error hiring candidate:", e)
            alert("An error occurred while hiring candidate.")
        } finally {
            setHiringLoading(false)
        }
    }

    // Batch candidate hire
    const handleHireBatch = async (appIds: string[], label?: string) => {
        if (!appIds || appIds.length === 0) return
        setHiringLoading(true)
        try {
            const user = auth.currentUser
            const res = await fetch('/api/recruiter/hire-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationIds: appIds,
                    recruiterUid: user?.uid
                })
            })

            if (res.ok) {
                const data = await res.json()
                const idSet = new Set(appIds)
                setInterviewedCandidates(prev => prev.map(c => 
                    idSet.has(c.applicationId) || idSet.has(c.id) ? { ...c, isHired: true, status: 'Hired' } : c
                ))
                setAllApplicants(prev => prev.map(c => 
                    idSet.has(c.applicationId) || idSet.has(c.id) ? { ...c, isHired: true, status: 'Hired' } : c
                ))
                setSelectedIds([])
                setHiredMessage(label || `Successfully hired ${data.hiredCount || appIds.length} candidate(s)! 🎉`)
                setTimeout(() => setHiredMessage(null), 5000)
            } else {
                const err = await res.json()
                alert(err.detail || "Failed to batch hire candidates")
            }
        } catch (e) {
            console.error("Error hiring candidates:", e)
            alert("An error occurred while hiring candidates.")
        } finally {
            setHiringLoading(false)
        }
    }

    // Top N Hire
    const handleHireTopN = (n: number) => {
        const unhiredCandidates = filteredInterviewed.filter(c => !c.isHired && c.status !== 'Hired')
        if (unhiredCandidates.length === 0) {
            alert("All interviewed candidates are already hired!")
            return
        }
        const topCandidates = unhiredCandidates.slice(0, n)
        const appIds = topCandidates.map(c => c.applicationId || c.id)
        handleHireBatch(appIds, `Successfully hired Top ${topCandidates.length} candidate(s) based on match score leaderboard! 🏆`)
    }

    return (
        <div className="space-y-8 pb-12 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                        Candidate Talent Pool
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Interviewed candidates ranked in descending order of role match score given by the interviewer.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-9 pr-4 py-2 text-sm text-slate-100 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-500"
                            placeholder="Search candidate, role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Notification Banner */}
            {hiredMessage && (
                <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <span className="font-bold text-sm">{hiredMessage}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setHiredMessage(null)} className="text-emerald-400 hover:bg-emerald-500/20 h-7 w-7 p-0 rounded-lg">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-800 bg-slate-950/60 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interviewed Candidates</CardTitle>
                        <Trophy className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-100">{interviewedCandidates.length}</div>
                        <p className="text-xs text-slate-400 mt-1">Evaluated by EchoSphere</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-950/60 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Match Score</CardTitle>
                        <Award className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400">{topMatch}%</div>
                        <p className="text-xs text-slate-400 mt-1">Highest role alignment</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-950/60 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hired Candidates</CardTitle>
                        <UserCheck className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400">{hiredCount}</div>
                        <p className="text-xs text-slate-400 mt-1">Accepted and hired</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-950/60 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Interview</CardTitle>
                        <User className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-purple-400">{pendingApplicants.length}</div>
                        <p className="text-xs text-slate-400 mt-1">Applied & waiting to interview</p>
                    </CardContent>
                </Card>
            </div>

            {/* SECTION 1: INTERVIEWED CANDIDATES (RANKED IN DESCENDING ORDER) */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                            <Trophy className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-100">Interviewed Candidates</h2>
                            <p className="text-xs text-slate-400">Arranged in descending order of match score given by interviewer</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold self-start sm:self-auto">
                        Ranked Leaderboard
                    </Badge>
                </div>

                {/* Hiring Action & Quick Presets Toolbar */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                        >
                            {selectedIds.length > 0 && selectedIds.length === filteredInterviewed.filter(c => !c.isHired && c.status !== 'Hired').length
                                ? "Deselect All"
                                : "Select All Unhired"}
                        </Button>

                        {selectedIds.length > 0 && (
                            <Button
                                size="sm"
                                onClick={() => handleHireBatch(selectedIds)}
                                disabled={hiringLoading}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-4 shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                            >
                                <UserCheck className="h-4 w-4" />
                                Hire Selected ({selectedIds.length})
                            </Button>
                        )}

                        <span className="text-xs text-slate-400 font-medium">
                            {selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'} selected
                        </span>
                    </div>

                    {/* Hire Top N Candidates Control */}
                    <div className="flex items-center gap-2 flex-wrap bg-slate-950/70 border border-slate-800/80 rounded-xl p-1.5">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1 px-2">
                            <Trophy className="h-3.5 w-3.5" /> Hire Top:
                        </span>
                        {[1, 3, 5, 10].map(preset => (
                            <Button
                                key={preset}
                                size="sm"
                                variant="ghost"
                                onClick={() => { setTopNInput(preset); handleHireTopN(preset) }}
                                disabled={hiringLoading || filteredInterviewed.filter(c => !c.isHired && c.status !== 'Hired').length === 0}
                                className={cn(
                                    "h-7 px-2.5 text-xs font-bold rounded-lg transition-all",
                                    topNInput === preset
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                                )}
                            >
                                Top {preset}
                            </Button>
                        ))}
                        <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
                            <input
                                type="number"
                                min={1}
                                max={Math.max(filteredInterviewed.length, 1)}
                                value={topNInput}
                                onChange={(e) => setTopNInput(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 h-7 rounded-lg bg-slate-900 border border-slate-700 text-center text-xs font-bold text-slate-200 outline-none focus:border-amber-400"
                            />
                            <Button
                                size="sm"
                                onClick={() => handleHireTopN(topNInput)}
                                disabled={hiringLoading || filteredInterviewed.filter(c => !c.isHired && c.status !== 'Hired').length === 0}
                                className="h-7 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-black text-xs rounded-lg shadow-md shadow-amber-500/10 flex items-center gap-1"
                            >
                                <Sparkles className="h-3.5 w-3.5" /> Hire Top {topNInput}
                            </Button>
                        </div>
                    </div>
                </div>

                <Card className="border-slate-800 bg-slate-950/80 shadow-2xl overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                                <p className="text-slate-400 text-sm">Loading candidates from MongoDB...</p>
                            </div>
                        ) : filteredInterviewed.length === 0 ? (
                            <div className="py-16 text-center space-y-3">
                                <div className="h-14 w-14 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-500">
                                    <Trophy className="h-6 w-6" />
                                </div>
                                <p className="text-slate-300 font-bold text-base">No candidates have taken the interview yet</p>
                                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                                    When applicants click "Give Interview" and complete their technical assessment, they will appear here ranked by their match score.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/80">
                                <AnimatePresence mode="popLayout">
                                    {filteredInterviewed.map((candidate, index) => {
                                        const rank = candidate.rank || (index + 1)
                                        const isTop3 = rank <= 3
                                        const isHired = candidate.isHired || candidate.status === 'Hired'
                                        const isSelected = selectedIds.includes(candidate.applicationId || candidate.id)

                                        const medalColor = rank === 1
                                            ? "from-amber-400 to-amber-600 text-amber-950 shadow-amber-500/30"
                                            : rank === 2
                                                ? "from-slate-200 to-slate-400 text-slate-950 shadow-slate-400/20"
                                                : rank === 3
                                                    ? "from-amber-700 to-amber-900 text-amber-100 shadow-amber-700/20"
                                                    : "bg-slate-800 text-slate-300"

                                        const scoreColor = candidate.matchScore >= 85
                                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                            : candidate.matchScore >= 70
                                                ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
                                                : "text-amber-400 border-amber-500/30 bg-amber-500/10"

                                        return (
                                            <motion.div
                                                layout
                                                variants={item}
                                                initial="hidden"
                                                animate="show"
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ delay: index * 0.04 }}
                                                key={candidate.id || candidate.applicationId || index}
                                                className={cn(
                                                    "group flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-slate-900/60 transition-colors gap-4",
                                                    isHired && "bg-emerald-950/20 border-l-4 border-emerald-500",
                                                    isSelected && !isHired && "bg-blue-950/20"
                                                )}
                                            >
                                                {/* Left info with Select Checkbox & Rank Medal */}
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    {/* Select Checkbox */}
                                                    <input
                                                        type="checkbox"
                                                        disabled={isHired}
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelect(candidate.applicationId || candidate.id)}
                                                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-20 shrink-0"
                                                    />

                                                    {/* Rank Badge */}
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-md",
                                                        isTop3 ? `bg-gradient-to-br ${medalColor}` : medalColor
                                                    )}>
                                                        #{rank}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="font-bold text-lg text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                                                                {candidate.name}
                                                            </h3>
                                                            {isHired ? (
                                                                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold py-0.5 px-2.5 rounded-full flex items-center gap-1 shadow-sm">
                                                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Hired 🎉
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold py-0.5 px-2.5 rounded-full flex items-center gap-1">
                                                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Finished Interview
                                                                </Badge>
                                                            )}
                                                            <Badge variant="outline" className={cn("text-xs font-bold py-0.5 px-2.5 rounded-full", scoreColor)}>
                                                                {candidate.recommendation || "Completed"}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-400 flex items-center gap-2 mt-0.5">
                                                            <span className="text-slate-300 font-semibold">{candidate.role}</span>
                                                            <span className="opacity-30">•</span>
                                                            <Mail className="h-3 w-3" /> {candidate.email || "Candidate"}
                                                            <span className="opacity-30">•</span>
                                                            <Calendar className="h-3 w-3" /> {candidate.applied || "Recent"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Center Scores & Action Buttons */}
                                                <div className="flex items-center gap-5 justify-between md:justify-end shrink-0 flex-wrap">
                                                    <div className="flex items-center gap-4 text-right">
                                                        <div className="text-center">
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Technical</div>
                                                            <div className="text-sm font-bold text-slate-200">{candidate.technicalScore || 0}%</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comm.</div>
                                                            <div className="text-sm font-bold text-slate-200">{candidate.communicationScore || 0}%</div>
                                                        </div>
                                                        <div className="text-right pl-2 border-l border-slate-800">
                                                            <div className="text-2xl font-black text-emerald-400 tabular-nums">
                                                                {candidate.matchScore}%
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Match to Role</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isHired ? (
                                                            <Button
                                                                disabled
                                                                size="sm"
                                                                className="bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl px-3.5 h-9 cursor-default flex items-center gap-1"
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                                                Hired
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                onClick={() => handleHireSingle(candidate)}
                                                                disabled={hiringLoading}
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-3.5 h-9 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1 shrink-0"
                                                            >
                                                                <UserCheck className="h-3.5 w-3.5" />
                                                                Hire
                                                            </Button>
                                                        )}

                                                        <Button
                                                            onClick={() => setSelectedCandidate(candidate)}
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold rounded-xl px-3.5 h-9 shadow-sm shrink-0"
                                                        >
                                                            <FileText className="h-3.5 w-3.5 mr-1" />
                                                            Report
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* SECTION 2: PENDING INTERVIEW APPLICANTS */}
            {pendingApplicants.length > 0 && (
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-slate-100">Pending Interview Applicants</h2>
                                <p className="text-xs text-slate-400">Candidates who applied and are queued to give their interview</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">
                            {pendingApplicants.length} Pending
                        </Badge>
                    </div>

                    <Card className="border-slate-800 bg-slate-950/60 shadow-lg">
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-800/60">
                                {pendingApplicants.map((applicant) => (
                                    <div key={applicant.id || applicant.applicationId} className="flex items-center justify-between p-4 hover:bg-slate-900/40 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                                                {(applicant.name || "C")[0]}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-200">{applicant.name}</h4>
                                                <p className="text-xs text-slate-400">{applicant.role} • {applicant.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs font-semibold">
                                                Interview Pending
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Candidate Evaluation Report Modal */}
            {selectedCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedCandidate(null)} />
                    <Card className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-slate-700 bg-slate-950 text-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold">
                                        Rank #{selectedCandidate.rank}
                                    </Badge>
                                    {selectedCandidate.isHired || selectedCandidate.status === 'Hired' ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Hired 🎉
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Finished Interview
                                        </Badge>
                                    )}
                                    <CardTitle className="text-2xl font-bold">{selectedCandidate.name}</CardTitle>
                                </div>
                                <CardDescription className="text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                                    <span>{selectedCandidate.role} • {selectedCandidate.email}</span>
                                    {selectedCandidate.candidateId && (
                                        <span className="font-mono text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                                            Candidate ID: {selectedCandidate.candidateId}
                                        </span>
                                    )}
                                    {selectedCandidate.interviewId && (
                                        <span className="font-mono text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                                            Interview ID: {selectedCandidate.interviewId}
                                        </span>
                                    )}
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedCandidate(null)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {/* Score Overview */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                                    <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Role Match Score</div>
                                    <div className="text-3xl font-black text-emerald-400 mt-1">{selectedCandidate.matchScore}%</div>
                                </div>
                                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">Technical Score</div>
                                    <div className="text-3xl font-black text-blue-400 mt-1">{selectedCandidate.technicalScore || 0}%</div>
                                </div>
                                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                                    <div className="text-xs text-purple-400 font-bold uppercase tracking-wider">Communication</div>
                                    <div className="text-3xl font-black text-purple-400 mt-1">{selectedCandidate.communicationScore || 0}%</div>
                                </div>
                            </div>

                            {/* Recommendation */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Interviewer Recommendation</h4>
                                <div className="rounded-xl bg-slate-900/80 p-4 border border-slate-800 text-sm font-semibold text-slate-200">
                                    {selectedCandidate.recommendation || "Consider"}
                                </div>
                            </div>

                            {/* Strengths */}
                            {selectedCandidate.report?.strengths && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Identified Strengths</h4>
                                    <ul className="list-disc list-inside text-sm space-y-1 text-slate-300 rounded-xl bg-slate-900/50 p-4 border border-slate-800">
                                        {(Array.isArray(selectedCandidate.report.strengths) ? selectedCandidate.report.strengths : [selectedCandidate.report.strengths]).map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Areas for Improvement */}
                            {selectedCandidate.report?.areas_for_improvement && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Areas for Improvement</h4>
                                    <ul className="list-disc list-inside text-sm space-y-1 text-slate-300 rounded-xl bg-slate-900/50 p-4 border border-slate-800">
                                        {(Array.isArray(selectedCandidate.report.areas_for_improvement) ? selectedCandidate.report.areas_for_improvement : [selectedCandidate.report.areas_for_improvement]).map((a: string, i: number) => (
                                            <li key={i}>{a}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                {selectedCandidate.isHired || selectedCandidate.status === 'Hired' ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Candidate Hired 🎉
                                    </Badge>
                                ) : (
                                    <Button
                                        onClick={() => handleHireSingle(selectedCandidate)}
                                        disabled={hiringLoading}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-5 h-10 shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                                    >
                                        <UserCheck className="h-4 w-4" />
                                        Hire This Candidate
                                    </Button>
                                )}

                                <Button onClick={() => setSelectedCandidate(null)} className="font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl">
                                    Close Details
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
