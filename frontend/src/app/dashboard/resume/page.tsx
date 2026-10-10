"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { User, GraduationCap, Briefcase, Code, Download, Save, Plus, Trash2, LayoutTemplate, Palette, Sparkles, Wand2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { useRef } from "react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth"
import { useRouter } from "next/navigation"

function InputGroup({ label, name, value, onChange, placeholder }: any) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            <input
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:border-indigo-200"
            />
        </div>
    )
}

// Types for Resume Data
type ResumeData = {
    personal: {
        fullName: string
        email: string
        phone: string
        linkedin: string
        location: string
        summary: string
        role: string
        targetCompany: string
    }
    education: Array<{
        id: string
        school: string
        degree: string
        year: string
        percentage: string
        type: string // "10th", "12th", "College", "Other"
    }>
    experience: Array<{
        id: string
        company: string
        role: string
        duration: string
        details: string
    }>
    skills: string
    projects: Array<{
        id: string
        name: string
        tech: string
        link?: string
        description: string
    }>
    achievements: Array<{
        id: string
        title: string
        date: string
        description: string
    }>
    analysis?: {
        score: number
        status: string
        feedback: string
        strengths: string[]
        improvements: string[]
    }
}

export default function ResumePage() {
    const router = useRouter()
    const [template, setTemplate] = useState<"modern" | "classic" | "tech">("modern")
    const [isSaving, setIsSaving] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)

    // Initial State - Empty or minimal defaults
    const [data, setData] = useState<ResumeData>({
        personal: {
            fullName: "",
            email: "",
            phone: "",
            linkedin: "",
            location: "",
            summary: "",
            role: "",
            targetCompany: "",
        },
        education: [],
        experience: [],
        skills: "",
        projects: [],
        achievements: []
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                // Fetch existing resume
                try {
                    const res = await fetch(`/api/resume?email=${user.email}`)
                    const result = await res.json()
                    if (result.success && result.data) {
                        setData(result.data)
                    } else {
                        // Pre-fill basic info if new
                        setData(prev => ({
                            ...prev,
                            personal: {
                                ...prev.personal,
                                fullName: user.displayName || "",
                                email: user.email || ""
                            }
                        }))
                    }
                } catch (error) {
                    console.error("Failed to fetch resume", error)
                }
            }
        })
        return () => unsubscribe()
    }, [])

    const resumeRef = useRef<HTMLDivElement>(null)

    const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setData({ ...data, personal: { ...data.personal, [e.target.name]: e.target.value } })
    }

    const handleAddExperience = () => {
        const newExp = { id: Date.now().toString(), company: "", role: "", duration: "", details: "" }
        setData({ ...data, experience: [...data.experience, newExp] })
    }

    const handleAddEducation = () => {
        const newEdu = { id: Date.now().toString(), school: "", degree: "", year: "", percentage: "", type: "College" }
        setData({ ...data, education: [...data.education, newEdu] })
    }

    const handleAddProject = () => {
        const newProj = { id: Date.now().toString(), name: "", tech: "", link: "", description: "" }
        setData({ ...data, projects: [...data.projects, newProj] })
    }

    const handleAddAchievement = () => {
        const newAch = { id: Date.now().toString(), title: "", date: "", description: "" }
        setData({ ...data, achievements: [...data.achievements, newAch] })
    }

    const deleteItem = (section: keyof ResumeData, id: string) => {
        if (Array.isArray(data[section])) {
            setData({ ...data, [section]: (data[section] as any[]).filter(item => item.id !== id) })
        }
    }

    const handleSaveResume = async () => {
        setIsSaving(true);
        try {
            // Ensure email and UID are set in the payload
            const payload: any = { ...data };
            if (!payload.personal.email && currentUser?.email) {
                payload.personal.email = currentUser.email;
            }
            if (currentUser?.uid) {
                payload.uid = currentUser.uid;
            }

            const response = await fetch('/api/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (result.success) {
                if (result.data) {
                    setData(result.data);
                }
                alert("Resume saved successfully!");
            } else {
                alert("Error saving resume: " + (result.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Error saving resume:", error);
            alert("Failed to save resume.");
        } finally {
            setIsSaving(false);
        }
    }

    const handleExportPDF = async () => {
        if (!resumeRef.current) return;

        setIsSaving(true);
        try {
            const canvas = await html2canvas(resumeRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff"
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${data.personal.fullName.replace(/\s+/g, '_')}_Resume.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("Failed to export PDF.");
        } finally {
            setIsSaving(false);
        }
    }

    const handleAnalyzeResume = async () => {
        setIsAnalyzing(true);
        try {
            const payload: any = { ...data };
            if (!payload.personal.email && currentUser?.email) {
                payload.personal.email = currentUser.email;
            }
            if (currentUser?.uid) {
                payload.uid = currentUser.uid;
            }

            // Save first to ensure persistent record
            await fetch('/api/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // Call AI analysis
            const res = await fetch('/api/resume/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resumeData: payload, email: currentUser?.email, uid: currentUser?.uid }),
            });
            const result = await res.json();
            if (result.success && result.analysis) {
                setData(prev => ({ ...prev, analysis: result.analysis }));
                router.push('/dashboard/analysis');
            } else {
                alert("Failed to analyze resume with AI.");
            }
        } catch (error) {
            console.error("AI Analysis error:", error);
            alert("Error running AI resume analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    }

    return (
        <div className="flex flex-col min-h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)] gap-6 p-4 md:p-0">
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-background/50 backdrop-blur-sm p-4 rounded-xl border">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <LayoutTemplate className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Resume Builder</h1>
                        <p className="text-xs text-muted-foreground">Professional Profile & Templates</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                    <Button
                        variant={template === "modern" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTemplate("modern")}
                        className="text-xs"
                    >
                        Modern
                    </Button>
                    <Button
                        variant={template === "classic" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTemplate("classic")}
                        className="text-xs"
                    >
                        Classic
                    </Button>
                    <Button
                        variant={template === "tech" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTemplate("tech")}
                        className="text-xs"
                    >
                        Tech
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                        onClick={handleAnalyzeResume}
                        disabled={isSaving || isAnalyzing}
                    >
                        {isAnalyzing ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
                        )}
                        {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                    <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleSaveResume}
                        disabled={isSaving || isAnalyzing}
                    >
                        {isSaving ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {isSaving ? "Saving..." : "Save Resume"}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                        onClick={handleExportPDF}
                        disabled={isSaving || isAnalyzing}
                    >
                        {isSaving ? (
                            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        {isSaving ? "Exporting..." : "Export PDF"}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row flex-1 gap-6 overflow-hidden">
                {/* Left Panel: Editor */}
                <Card className="w-full md:w-1/2 flex flex-col shadow-lg border-indigo-100 dark:border-indigo-900/20 overflow-hidden">
                    <Tabs defaultValue="personal" className="flex-1 flex flex-col">
                        <div className="px-4 pt-4 border-b bg-muted/30">
                            <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                <TabsTrigger value="personal" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border py-2 text-xs">Personal</TabsTrigger>
                                <TabsTrigger value="experience" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border py-2 text-xs">Experience</TabsTrigger>
                                <TabsTrigger value="education" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border py-2 text-xs">Education</TabsTrigger>
                                <TabsTrigger value="projects" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border py-2 text-xs">Projects</TabsTrigger>
                                <TabsTrigger value="skills" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border py-2 text-xs">Skills</TabsTrigger>
                                <TabsTrigger value="achievements" className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border py-2 text-xs">Achievements</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/20">
                            <TabsContent value="personal" className="mt-0 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputGroup label="Full Name" name="fullName" value={data.personal.fullName} onChange={handlePersonalChange} />
                                    <InputGroup label="Job Title / Role" name="role" placeholder="e.g. Senior Software Engineer" value={data.personal.role} onChange={handlePersonalChange} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputGroup label="Email" name="email" value={data.personal.email} onChange={handlePersonalChange} />
                                    <InputGroup label="Phone" name="phone" value={data.personal.phone} onChange={handlePersonalChange} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputGroup label="LinkedIn" name="linkedin" value={data.personal.linkedin} onChange={handlePersonalChange} />
                                    <InputGroup label="Target Company" name="targetCompany" placeholder="e.g. Google, Meta" value={data.personal.targetCompany} onChange={handlePersonalChange} />
                                </div>
                                <InputGroup label="Location" name="location" value={data.personal.location} onChange={handlePersonalChange} />

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Professional Summary</label>
                                        <Button variant="ghost" className="h-6 text-xs px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                                            <Wand2 className="mr-1 h-3 w-3" />
                                            Rewrite with AI
                                        </Button>
                                    </div>
                                    <textarea
                                        name="summary"
                                        value={data.personal.summary}
                                        onChange={handlePersonalChange}
                                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 resize-none"
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="experience" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {data.experience.map((exp, i) => (
                                    <div key={exp.id} className="rounded-xl border bg-card p-4 space-y-4 shadow-sm relative group">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                            onClick={() => deleteItem('experience', exp.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputGroup label="Company" value={exp.company} onChange={(e: any) => {
                                                const newExp = [...data.experience]; newExp[i].company = e.target.value; setData({ ...data, experience: newExp });
                                            }} />
                                            <InputGroup label="Role" value={exp.role} onChange={(e: any) => {
                                                const newExp = [...data.experience]; newExp[i].role = e.target.value; setData({ ...data, experience: newExp });
                                            }} />
                                        </div>
                                        <InputGroup label="Duration" value={exp.duration} onChange={(e: any) => {
                                            const newExp = [...data.experience]; newExp[i].duration = e.target.value; setData({ ...data, experience: newExp });
                                        }} />
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Responsibilities</label>
                                            <textarea
                                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                value={exp.details}
                                                onChange={(e) => {
                                                    const newExp = [...data.experience]; newExp[i].details = e.target.value; setData({ ...data, experience: newExp });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full border-dashed border-2 hover:border-indigo-500 hover:text-indigo-600"
                                    onClick={handleAddExperience}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Experience
                                </Button>
                            </TabsContent>

                            <TabsContent value="education" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {data.education.map((edu, i) => (
                                    <div key={edu.id} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm relative group hover:border-indigo-200 transition-colors">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                            onClick={() => deleteItem('education', edu.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2 col-span-1 md:col-span-1">
                                                <label className="text-sm font-medium">Education Level</label>
                                                <select
                                                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all font-medium"
                                                    value={edu.type}
                                                    onChange={(e) => {
                                                        const newEdu = [...data.education]; newEdu[i].type = e.target.value; setData({ ...data, education: newEdu });
                                                    }}
                                                >
                                                    <option value="College">College / University</option>
                                                    <option value="12th">12th Grade (HS/Inter)</option>
                                                    <option value="10th">10th Grade (Schooling)</option>
                                                    <option value="Other">Certification / Diploma</option>
                                                </select>
                                            </div>
                                            <InputGroup label="School / University Name" value={edu.school} onChange={(e: any) => {
                                                const newEdu = [...data.education]; newEdu[i].school = e.target.value; setData({ ...data, education: newEdu });
                                            }} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                <InputGroup label="Degree / Stream" placeholder="e.g. Science, B.Tech" value={edu.degree} onChange={(e: any) => {
                                                    const newEdu = [...data.education]; newEdu[i].degree = e.target.value; setData({ ...data, education: newEdu });
                                                }} />
                                            </div>
                                            <InputGroup label="Passout Year" placeholder="2024" value={edu.year} onChange={(e: any) => {
                                                const newEdu = [...data.education]; newEdu[i].year = e.target.value; setData({ ...data, education: newEdu });
                                            }} />
                                        </div>
                                        <InputGroup label="Percentage % / CGPA" placeholder="e.g. 85%" value={edu.percentage || ""} onChange={(e: any) => {
                                            const newEdu = [...data.education]; newEdu[i].percentage = e.target.value; setData({ ...data, education: newEdu });
                                        }} />
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full h-12 border-dashed border-2 hover:border-indigo-500 hover:text-indigo-600 bg-indigo-50/10"
                                    onClick={handleAddEducation}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Education
                                </Button>
                                <div className="h-10" />
                            </TabsContent>

                            <TabsContent value="projects" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {data.projects.map((proj, i) => (
                                    <div key={proj.id} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm relative group hover:border-indigo-200 transition-colors">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                            onClick={() => deleteItem('projects', proj.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputGroup label="Project Name" value={proj.name} onChange={(e: any) => {
                                                const newProjects = [...data.projects]; newProjects[i].name = e.target.value; setData({ ...data, projects: newProjects });
                                            }} />
                                            <InputGroup label="Technologies" value={proj.tech} placeholder="e.g. React, Node.js" onChange={(e: any) => {
                                                const newProjects = [...data.projects]; newProjects[i].tech = e.target.value; setData({ ...data, projects: newProjects });
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputGroup label="Project Link" value={proj.link} placeholder="https://github.com/..." onChange={(e: any) => {
                                                const newProjects = [...data.projects]; newProjects[i].link = e.target.value; setData({ ...data, projects: newProjects });
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Description</label>
                                            <textarea
                                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all hover:border-indigo-200"
                                                value={proj.description}
                                                onChange={(e) => {
                                                    const newProjects = [...data.projects]; newProjects[i].description = e.target.value; setData({ ...data, projects: newProjects });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full h-12 border-dashed border-2 hover:border-indigo-500 hover:text-indigo-600 bg-indigo-50/10"
                                    onClick={handleAddProject}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Project
                                </Button>
                                <div className="h-10" /> {/* Space for bottom access */}
                            </TabsContent>

                            <TabsContent value="achievements" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {data.achievements.map((ach, i) => (
                                    <div key={ach.id} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm relative group hover:border-indigo-200 transition-colors">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                            onClick={() => deleteItem('achievements', ach.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputGroup label="Award/Achievement Title" value={ach.title} placeholder="e.g. 1st Place - AI Hackathon" onChange={(e: any) => {
                                                const newAch = [...data.achievements]; newAch[i].title = e.target.value; setData({ ...data, achievements: newAch });
                                            }} />
                                            <InputGroup label="Date / Year" value={ach.date} placeholder="2025" onChange={(e: any) => {
                                                const newAch = [...data.achievements]; newAch[i].date = e.target.value; setData({ ...data, achievements: newAch });
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Description</label>
                                            <textarea
                                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all hover:border-indigo-200"
                                                value={ach.description}
                                                onChange={(e) => {
                                                    const newAch = [...data.achievements]; newAch[i].description = e.target.value; setData({ ...data, achievements: newAch });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full h-12 border-dashed border-2 hover:border-indigo-500 hover:text-indigo-600 bg-indigo-50/10"
                                    onClick={handleAddAchievement}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Achievement
                                </Button>
                                <div className="h-10" />
                            </TabsContent>

                            <TabsContent value="skills" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Skills (Comma Separated)</label>
                                    <textarea
                                        value={data.skills}
                                        onChange={(e) => setData({ ...data, skills: e.target.value })}
                                        className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                        placeholder="Java, Python, System Design, GraphQL..."
                                    />
                                    <p className="text-xs text-muted-foreground">Tip: AI finds that adding "AWS" would increase your profile match by 15%.</p>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>

                {/* Right Panel: Preview */}
                <div className="w-full md:w-1/2 flex flex-col h-full bg-slate-100 dark:bg-slate-900 rounded-xl border overflow-hidden relative">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

                    {/* Scrollable Container */}
                    <div className="flex-1 overflow-auto w-full custom-scrollbar p-4 md:p-8">
                        {/* AI Analysis Section */}
                        {data.analysis && data.analysis.score > 0 && (
                            <div className="mb-8 relative z-10 max-w-[21cm] mx-auto">
                                <Card className="border-indigo-200 bg-indigo-50/90 backdrop-blur-sm dark:bg-indigo-900/20 dark:border-indigo-800 shadow-sm">
                                    <CardContent className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                                                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                AI Analysis
                                            </h3>
                                            <div className={cn(
                                                "px-3 py-1 rounded-full text-xs font-bold",
                                                data.analysis.score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                                                    data.analysis.score >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
                                                        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                            )}>
                                                Score: {data.analysis.score}/100
                                            </div>
                                        </div>

                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                                            "{data.analysis.feedback}"
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                            {data.analysis.strengths && data.analysis.strengths.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Strengths</p>
                                                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-slate-600 dark:text-slate-400">
                                                        {data.analysis.strengths.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                                                    </ul>
                                                </div>
                                            )}

                                            {data.analysis.improvements && data.analysis.improvements.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Improvements</p>
                                                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-slate-600 dark:text-slate-400">
                                                        {data.analysis.improvements.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* A4 Resume Container */}
                        <div ref={resumeRef} className="min-w-fit flex justify-center pb-20">
                            <motion.div
                                layout
                                className={cn(
                                    "bg-white text-black shadow-2xl transition-all duration-300 min-h-[29.7cm] w-[21cm] p-[2.5cm] scale-[0.6] sm:scale-[0.7] md:scale-[0.85] lg:scale-100 origin-top",
                                    template === "modern" ? "font-sans" : template === "classic" ? "font-serif" : "font-mono"
                                )}
                            >
                                {/* Template: Modern */}
                                {template === "modern" && (
                                    <div className="space-y-6">
                                        <header className="border-b-2 border-slate-800 pb-6">
                                            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{data.personal.fullName}</h1>
                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 font-medium">
                                                <span>{data.personal.location}</span>
                                                <span>•</span>
                                                <a href={`mailto:${data.personal.email}`} className="hover:text-indigo-600">{data.personal.email}</a>
                                                <span>•</span>
                                                <span>{data.personal.phone}</span>
                                            </div>
                                        </header>

                                        <section>
                                            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-3">Professional Summary</h2>
                                            <p className="text-sm leading-relaxed text-slate-700">{data.personal.summary}</p>
                                        </section>

                                        <section>
                                            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-4">Experience</h2>
                                            <div className="space-y-5">
                                                {data.experience.map((exp, i) => (
                                                    <div key={i}>
                                                        <div className="flex justify-between items-baseline">
                                                            <h3 className="font-bold text-slate-900 text-base">{exp.role}</h3>
                                                            <span className="text-sm font-medium text-slate-500">{exp.duration}</span>
                                                        </div>
                                                        <div className="text-sm font-semibold text-slate-700 mb-2">{exp.company}</div>
                                                        <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{exp.details}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section>
                                            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-4">Education</h2>
                                            {data.education.map((edu, i) => (
                                                <div key={i} className="mb-3">
                                                    <div className="flex justify-between items-baseline">
                                                        <h3 className="font-bold text-slate-900">{edu.school}</h3>
                                                        <span className="text-sm text-slate-500">{edu.year}</span>
                                                    </div>
                                                    <div className="text-sm text-slate-700">{edu.type}: {edu.degree}</div>
                                                    {edu.percentage && <div className="text-sm text-slate-500 mt-1">Result: {edu.percentage}</div>}
                                                </div>
                                            ))}
                                        </section>

                                        <section>
                                            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-3">Skills</h2>
                                            <div className="flex flex-wrap gap-2">
                                                {data.skills.split(',').map((skill, i) => (
                                                    <span key={i} className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                                                        {skill.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </section>

                                        {data.projects.length > 0 && (
                                            <section>
                                                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-4">Selected Projects</h2>
                                                <div className="space-y-4">
                                                    {data.projects.map((proj, i) => (
                                                        <div key={i}>
                                                            <div className="flex justify-between items-baseline">
                                                                <h3 className="font-bold text-slate-900 text-base">{proj.name}</h3>
                                                                {proj.link && <span className="text-xs text-indigo-500 italic font-medium">{proj.link}</span>}
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-1">{proj.tech}</div>
                                                            <p className="text-sm text-slate-600 leading-relaxed">{proj.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {data.achievements.length > 0 && (
                                            <section>
                                                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-3">Achievements</h2>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {data.achievements.map((ach, i) => (
                                                        <li key={i} className="text-sm text-slate-700">
                                                            <span className="font-bold text-slate-900">{ach.title}</span> ({ach.date}) — {ach.description}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                        )}
                                    </div>
                                )}

                                {/* Template: Classic (Times New Roman style) */}
                                {template === "classic" && (
                                    <div className="space-y-4 text-slate-900">
                                        <header className="text-center border-b border-black pb-4 mb-6">
                                            <h1 className="text-3xl font-bold mb-2">{data.personal.fullName}</h1>
                                            <div className="text-sm">
                                                {data.personal.location} | {data.personal.email} | {data.personal.phone}
                                            </div>
                                        </header>

                                        <section>
                                            <h2 className="text-base font-bold uppercase border-b border-black mb-3">Summary</h2>
                                            <p className="text-sm leading-relaxed">{data.personal.summary}</p>
                                        </section>

                                        <section>
                                            <h2 className="text-base font-bold uppercase border-b border-black mb-3">Experience</h2>
                                            <div className="space-y-4">
                                                {data.experience.map((exp, i) => (
                                                    <div key={i}>
                                                        <div className="flex justify-between items-baseline font-bold">
                                                            <h3>{exp.company}</h3>
                                                            <span>{exp.duration}</span>
                                                        </div>
                                                        <div className="italic text-sm mb-1">{exp.role}</div>
                                                        <p className="text-sm whitespace-pre-line">{exp.details}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section>
                                            <h2 className="text-base font-bold uppercase border-b border-black mb-3">Education</h2>
                                            {data.education.map((edu, i) => (
                                                <div key={i}>
                                                    <div className="flex justify-between font-bold">
                                                        <h3>{edu.school}</h3>
                                                        <span>{edu.year}</span>
                                                    </div>
                                                    <div className="text-sm italic">{edu.degree}</div>
                                                </div>
                                            ))}
                                        </section>
                                        <section>
                                            <h2 className="text-base font-bold uppercase border-b border-black mb-3">Skills</h2>
                                            <p className="text-sm">{data.skills}</p>
                                        </section>

                                        {data.projects.length > 0 && (
                                            <section>
                                                <h2 className="text-base font-bold uppercase border-b border-black mb-3">Projects</h2>
                                                <div className="space-y-3">
                                                    {data.projects.map((proj, i) => (
                                                        <div key={i}>
                                                            <div className="flex justify-between font-bold">
                                                                <h3>{proj.name}</h3>
                                                                <span className="text-xs font-normal italic">{proj.link}</span>
                                                            </div>
                                                            <div className="text-xs italic mb-1">{proj.tech}</div>
                                                            <p className="text-sm">{proj.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {data.achievements.length > 0 && (
                                            <section>
                                                <h2 className="text-base font-bold uppercase border-b border-black mb-3">Achievements</h2>
                                                <ul className="list-disc list-inside">
                                                    {data.achievements.map((ach, i) => (
                                                        <li key={i} className="text-sm">
                                                            <strong>{ach.title}</strong> ({ach.date}) — {ach.description}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                        )}
                                    </div>
                                )}

                                {/* Template: Tech (Monospace / Minimal) */}
                                {template === "tech" && (
                                    <div className="space-y-6 text-slate-800">
                                        <header className="mb-8">
                                            <h1 className="text-5xl font-light tracking-tighter mb-4 text-emerald-600">{`> ${data.personal.fullName}`}</h1>
                                            <div className="text-sm font-medium opacity-70">
                                                {`// ${data.personal.location} • ${data.personal.email}`}
                                            </div>
                                        </header>

                                        <section className="grid grid-cols-[120px_1fr] gap-4">
                                            <h2 className="text-sm font-bold text-slate-400 text-right">SUMMARY</h2>
                                            <p className="text-sm leading-relaxed">{data.personal.summary}</p>
                                        </section>

                                        <section className="grid grid-cols-[120px_1fr] gap-4">
                                            <h2 className="text-sm font-bold text-slate-400 text-right">EXPERIENCE</h2>
                                            <div className="space-y-6">
                                                {data.experience.map((exp, i) => (
                                                    <div key={i}>
                                                        <div className="font-bold text-base mb-1">{exp.role} <span className="text-emerald-600">@ {exp.company}</span></div>
                                                        <div className="text-xs text-slate-400 mb-2 uppercase tracking-widest">{exp.duration}</div>
                                                        <p className="text-sm whitespace-pre-line">{exp.details}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="grid grid-cols-[120px_1fr] gap-4">
                                            <h2 className="text-sm font-bold text-slate-400 text-right">EDUCATION</h2>
                                            <div className="space-y-2">
                                                {data.education.map((edu, i) => (
                                                    <div key={i}>
                                                        <div className="font-bold">{edu.school}</div>
                                                        <div className="text-sm">{edu.type}: {edu.degree} <span className="text-slate-400">// {edu.year}</span></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                        <section className="grid grid-cols-[120px_1fr] gap-4">
                                            <h2 className="text-sm font-bold text-slate-400 text-right">STACK</h2>
                                            <div className="text-sm leading-relaxed font-medium">
                                                [{data.skills.split(',').join('] [')}]
                                            </div>
                                        </section>

                                        {data.projects.length > 0 && (
                                            <section className="grid grid-cols-[120px_1fr] gap-4">
                                                <h2 className="text-sm font-bold text-slate-400 text-right">PROJECTS</h2>
                                                <div className="space-y-4">
                                                    {data.projects.map((proj, i) => (
                                                        <div key={i}>
                                                            <div className="font-bold text-base mb-1">{proj.name} <span className="text-emerald-600 font-normal text-xs ml-2">{proj.link}</span></div>
                                                            <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-widest">{proj.tech}</div>
                                                            <p className="text-sm opacity-80">{proj.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {data.achievements.length > 0 && (
                                            <section className="grid grid-cols-[120px_1fr] gap-4">
                                                <h2 className="text-sm font-bold text-slate-400 text-right">AWARDS</h2>
                                                <div className="space-y-2">
                                                    {data.achievements.map((ach, i) => (
                                                        <div key={i} className="text-sm">
                                                            <span className="text-emerald-600 font-bold">$ </span>
                                                            <span className="font-bold">{ach.title}</span>
                                                            <span className="text-slate-400 ml-2">({ach.date})</span>
                                                            <p className="ml-4 opacity-70 text-xs">{ach.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

