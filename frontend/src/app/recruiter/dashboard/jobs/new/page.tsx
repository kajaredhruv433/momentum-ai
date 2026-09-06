"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Rocket, ArrowLeft, Loader2, Sparkles, Building2, BriefcaseBusiness, DollarSign, Star, FileText, Upload, X } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

import { onAuthStateChanged, User } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function PostJobPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [user, setUser] = useState<User | null>(null)
    const [roleDocument, setRoleDocument] = useState<{ name: string; type: string; size: number; data: string } | null>(null)
    const [formData, setFormData] = useState({
        company: "",
        roleRequired: "",
        skillsRequired: "",
        experience: "",
        qualification: "",
        description: "",
        employeeQualities: "",
        location: "",
        type: "Full-time",
        salary: ""
    })

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser)
                try {
                    const res = await fetch("/api/users/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uid: currentUser.uid })
                    })
                    if (res.ok) {
                        const prof = await res.json()
                        if (prof.companyName) {
                            setFormData((prev) => ({ ...prev, company: prof.companyName }))
                        }
                    }
                } catch (e) {
                    console.error("Failed to load recruiter company", e)
                }
            }
        })
        return () => unsubscribe()
    }, [])

    const updateField = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleRoleDocument = (file: File | undefined) => {
        if (!file) return
        if (file.type !== "application/pdf") {
            alert("Please upload a PDF file.")
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            alert("The role PDF must be 5 MB or smaller.")
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setRoleDocument({ name: file.name, type: file.type, size: file.size, data: reader.result })
            }
        }
        reader.readAsDataURL(file)
    }

    const handlePublish = async () => {
        if (!formData.roleRequired || !formData.description || !formData.company) {
            alert("Please complete the company name, role, and description before publishing.")
            return
        }

        if (!user) {
            alert("Checking session... please wait a moment and try again.")
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    roleDocument,
                    title: formData.roleRequired,
                    uid: user.uid,
                    email: user.email
                })
            })

            if (response.ok) {
                router.push("/recruiter/dashboard/jobs")
            } else {
                throw new Error("Failed to publish job")
            }
        } catch (error) {
            console.error(error)
            alert("Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-6xl pb-4"
        >
            <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="rounded-full">
                        <Link href="/recruiter/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-lg font-bold text-blue-400">01</div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">Company & Job Profile</h1>
                    </div>
                </div>
                <Button variant="secondary" className="rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700">
                    Target Role
                </Button>
            </div>

            <div className="rounded-[28px] border border-slate-700/80 bg-[#0b1220]/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.55)] md:p-5">
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                        <Label htmlFor="company" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Building2 className="h-4 w-4 text-blue-400" /> Company Name
                        </Label>
                        <Input
                            id="company"
                            value={formData.company}
                            onChange={(e) => updateField("company", e.target.value)}
                            className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-xl text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                        />
                        </div>

                        <div className="space-y-2">
                        <Label htmlFor="roleRequired" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <BriefcaseBusiness className="h-4 w-4 text-blue-400" /> Role Required
                        </Label>
                        <Input
                            id="roleRequired"
                            value={formData.roleRequired}
                            onChange={(e) => updateField("roleRequired", e.target.value)}
                            className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-xl text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                            placeholder="Senior Backend Engineer"
                        />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="skillsRequired" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Sparkles className="h-4 w-4 text-blue-400" /> Skills Required
                        </Label>
                        <Input
                            id="skillsRequired"
                            value={formData.skillsRequired}
                            onChange={(e) => updateField("skillsRequired", e.target.value)}
                            className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-lg text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                            placeholder="Python, FastAPI, PostgreSQL, Redis, Docker, REST APIs"
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="experience" className="text-sm font-medium text-slate-300">Experience</Label>
                            <Input
                                id="experience"
                                value={formData.experience}
                                onChange={(e) => updateField("experience", e.target.value)}
                                className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-lg text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                                placeholder="3-5 years"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="salary" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <DollarSign className="h-4 w-4 text-blue-400" /> Salary
                            </Label>
                            <Input
                                id="salary"
                                value={formData.salary}
                                onChange={(e) => updateField("salary", e.target.value)}
                                className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-lg text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                                placeholder="15-25 LPA"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                        <Label htmlFor="qualification" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Star className="h-4 w-4 text-blue-400" /> Qualification
                        </Label>
                        <Input
                            id="qualification"
                            value={formData.qualification}
                            onChange={(e) => updateField("qualification", e.target.value)}
                            className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-lg text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                            placeholder="B.Tech / B.E. in Computer Science or equivalent"
                        />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="employeeQualities" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <Star className="h-4 w-4 text-blue-400" /> Employee Qualities
                            </Label>
                            <Input
                                id="employeeQualities"
                                value={formData.employeeQualities}
                                onChange={(e) => updateField("employeeQualities", e.target.value)}
                                className="h-14 rounded-xl border-slate-700 bg-slate-900/80 text-lg text-slate-50 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                                placeholder="Problem solving, ownership, communication, collaboration"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <Rocket className="h-4 w-4 text-blue-400" /> Description
                        </Label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => updateField("description", e.target.value)}
                            className="min-h-[130px] w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-base text-slate-50 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            placeholder="Design and develop high-throughput, resilient backend systems, distributed caching layers, and microservice architectures handling 20,000+ RPM."
                        />
                        <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/50 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-200">Role Resume / Job Description PDF</p>
                                        <p className="text-xs text-slate-500">Optional PDF, up to 5 MB. Candidates can view it with the job.</p>
                                    </div>
                                </div>
                                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition-colors hover:bg-blue-500/20">
                                    <Upload className="h-4 w-4" /> Upload PDF
                                    <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        className="sr-only"
                                        onChange={(event) => handleRoleDocument(event.target.files?.[0])}
                                    />
                                </label>
                            </div>
                            {roleDocument && (
                                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                                    <div className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                                        <FileText className="h-4 w-4 shrink-0 text-emerald-400" />
                                        <span className="truncate">{roleDocument.name}</span>
                                        <span className="shrink-0 text-xs text-slate-500">{(roleDocument.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setRoleDocument(null)} className="shrink-0 text-slate-400 hover:text-white">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:justify-end">
                        <Button variant="ghost" className="rounded-xl px-6 py-5 text-base font-semibold text-slate-300 hover:bg-slate-800 hover:text-white" disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePublish}
                            className="rounded-xl bg-blue-600 px-8 py-5 text-base font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publishing...
                                </>
                            ) : (
                                <>
                                    <Rocket className="mr-2 h-5 w-5" /> Publish Job
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
