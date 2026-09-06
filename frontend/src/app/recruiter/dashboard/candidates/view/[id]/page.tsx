"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, Mail, Phone, MapPin, Linkedin, Briefcase, GraduationCap, Code, FileText, Sparkles, FolderGit, ExternalLink, Trophy } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function CandidateViewPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const domain = searchParams.get("domain")
    const [candidate, setCandidate] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCandidate = async () => {
            try {
                const response = await fetch(`/api/applications/${params.id}`);
                const data = await response.json();
                setCandidate(data);
            } catch (error) {
                console.error("Error fetching candidate:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCandidate();
    }, [params.id]);

    if (loading) return <div className="p-10 text-center">Loading candidate details...</div>
    if (!candidate) return <div className="p-10 text-center text-destructive">Candidate not found.</div>

    const resumeData = candidate.resumeData || null;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Candidates
            </Button>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-muted/20 p-8 rounded-3xl border border-border/50 shadow-sm">
                <div>
                    <Badge className="mb-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200/50">Applicant Profile</Badge>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{candidate.name}</h1>
                    <p className="text-xl font-medium text-slate-500 mt-1">{candidate.role} <span className="text-slate-300 mx-2">|</span> {candidate.targetCompany}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "text-5xl font-black tracking-tighter tabular-nums",
                            (candidate.score || 0) >= 8.5 ? "text-emerald-500" : (candidate.score || 0) >= 7 ? "text-blue-500" : (candidate.score || 0) >= 5 ? "text-amber-500" : "text-red-500"
                        )}>{(candidate.score || 0).toFixed(1)}</div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">/ 10</div>
                    </div>
                    <Badge className={cn(
                        "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]",
                        (candidate.score || 0) >= 8.5 ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/50" : (candidate.score || 0) >= 7 ? "bg-blue-500/10 text-blue-600 border-blue-200/50" : "bg-amber-500/10 text-amber-600 border-amber-200/50"
                    )}>{candidate.status || "Applied"}</Badge>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1 border-none shadow-xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-wider text-slate-400">
                            <User className="h-4 w-4" /> Identity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 text-sm">
                        {resumeData?.personal ? (
                            <>
                                {resumeData.personal.summary && (
                                    <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                            "{resumeData.personal.summary}"
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 group">
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                                            <Mail className="h-4 w-4" />
                                        </div>
                                        <span className="font-medium">{resumeData.personal.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 group">
                                        <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                                            <Phone className="h-4 w-4" />
                                        </div>
                                        <span className="font-medium">{resumeData.personal.phone || "Not provided"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 group">
                                        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <span className="font-medium">{resumeData.personal.location || "Not provided"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 group">
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                                            <Linkedin className="h-4 w-4" />
                                        </div>
                                        <span className="truncate font-medium">{resumeData.personal.linkedin || "No LinkedIn linked"}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-400 italic">No identity metadata stored for this candidate.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 border-none shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <FileText className="h-32 w-32" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-wider text-blue-100/70">
                            <Sparkles className="h-4 w-4 text-amber-300" /> AI Recommendation Insight
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="rounded-2xl bg-white/10 backdrop-blur-md p-6 border border-white/20 shadow-inner">
                            <p className="text-md leading-relaxed font-medium text-white whitespace-pre-line">
                                {candidate.feedback || "Strategic domain evaluation pending for this applicant. Score reflects basic skill alignment."}
                            </p>
                        </div>
                        {resumeData?.analysis?.strengths?.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {resumeData.analysis.strengths.slice(0, 3).map((s: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="bg-emerald-400/20 text-emerald-50 border-emerald-400/30 font-medium">
                                        + {s}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {resumeData && (
                <div className="space-y-8 mt-10">
                    {/* Experience Section */}
                    <Card className="border-none shadow-xl">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b">
                            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                                <Briefcase className="h-6 w-6 text-blue-500" /> Work History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            {resumeData.experience && resumeData.experience.length > 0 ? (
                                resumeData.experience.map((exp: any) => (
                                    <div key={exp.id} className="relative pl-8 before:absolute before:left-0 before:top-1.5 before:bottom-0 before:w-0.5 before:bg-blue-100 dark:before:bg-blue-900 group">
                                        <div className="absolute left-[-4px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-950 group-hover:scale-125 transition-transform" />
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                            <h4 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{exp.role}</h4>
                                            <Badge variant="outline" className="w-fit text-blue-600 border-blue-200 font-bold uppercase tracking-wider text-[10px]">
                                                {exp.duration}
                                            </Badge>
                                        </div>
                                        <div className="text-md text-blue-600 font-bold mb-3">{exp.company}</div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed pb-6 border-b border-slate-50 dark:border-slate-900 last:border-0 last:pb-0">
                                            {exp.details}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-400">No professional experience listed.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Projects Section */}
                    {resumeData.projects && resumeData.projects.length > 0 && (
                        <Card className="border-none shadow-xl">
                            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b">
                                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                                    <FolderGit className="h-6 w-6 text-indigo-500" /> Key Projects
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 grid gap-6 md:grid-cols-2">
                                {resumeData.projects.map((project: any) => (
                                    <div key={project.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 transition-all hover:shadow-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="font-extrabold text-slate-900 dark:text-slate-100">{project.name}</h5>
                                            {project.link && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-500" asChild>
                                                    <a href={project.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                                </Button>
                                            )}
                                        </div>
                                        <div className="text-xs font-bold text-indigo-500 mb-3 uppercase tracking-widest">{project.tech}</div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                            {project.description}
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Skills and Education Side-by-Side */}
                        <div className="space-y-8">
                            <Card className="border-none shadow-xl h-full">
                                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b">
                                    <CardTitle className="flex items-center gap-3 font-extrabold uppercase tracking-tight">
                                        <Code className="h-5 w-5 text-blue-500" /> Expertise
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="flex flex-wrap gap-2">
                                        {resumeData.skills ? resumeData.skills.split(',').map((skill: string, i: number) => (
                                            <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold px-3 py-1 text-xs">
                                                {skill.trim()}
                                            </Badge>
                                        )) : <p className="text-slate-400">No skills specified.</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-8">
                            <Card className="border-none shadow-xl h-full">
                                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b">
                                    <CardTitle className="flex items-center gap-3 font-extrabold uppercase tracking-tight">
                                        <GraduationCap className="h-5 w-5 text-emerald-500" /> Education
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    {resumeData.education && resumeData.education.length > 0 ? (
                                        resumeData.education.map((edu: any) => (
                                            <div key={edu.id} className="group">
                                                <div className="flex justify-between items-start gap-4 mb-1">
                                                    <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{edu.school}</h4>
                                                    <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">{edu.year}</span>
                                                </div>
                                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{edu.degree}</div>
                                                {edu.percentage && <div className="text-xs font-bold text-emerald-600 mt-1">Score: {edu.percentage}</div>}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-slate-400">Education history not provided.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Achievements Section */}
                    {resumeData.achievements && resumeData.achievements.length > 0 && (
                        <Card className="border-none shadow-xl bg-slate-900 text-white">
                            <CardHeader className="border-b border-white/5">
                                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                                    <Trophy className="h-6 w-6 text-amber-400" /> Key Achievements
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 grid gap-8 md:grid-cols-2">
                                {resumeData.achievements.map((achievement: any) => (
                                    <div key={achievement.id} className="flex gap-4 group">
                                        <div className="mt-1 flex-shrink-0">
                                            <div className="h-8 w-8 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 border border-amber-400/30 group-hover:bg-amber-400 group-hover:text-slate-900 transition-all">
                                                <Trophy className="h-4 w-4" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-4">
                                                <h5 className="font-extrabold text-white text-md tracking-tight">{achievement.title}</h5>
                                                <span className="text-[10px] font-black text-slate-400 whitespace-nowrap uppercase tracking-widest">{achievement.date}</span>
                                            </div>
                                            <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                                {achievement.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
}
