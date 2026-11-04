"use client"

import { readApiJson } from "@/lib/api-response";

import Link from "next/link"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MomentumBackground } from "@/components/ui/momentum-background"
import { ArrowLeft, Loader2, Mail, Briefcase, User } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"

import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, User as FirebaseUser, onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function RegisterPage() {
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState<boolean>(true)
    const [role, setRole] = useState<"user" | "recruiter">("user")
    const [password, setPassword] = useState("")
    const [name, setName] = useState("")
    const [companyName, setCompanyName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [email, setEmail] = useState("")

    // State for Google Signup Company Name Modal
    const [showCompanyDialog, setShowCompanyDialog] = useState(false)
    const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null)
    const [googleCompanyName, setGoogleCompanyName] = useState("")
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)

    // Auto-login detection: if already authenticated, go to dashboard
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const cachedRole = typeof window !== "undefined" ? localStorage.getItem("momentum_role") : null
                if (cachedRole === "recruiter") {
                    window.location.href = "/recruiter/dashboard"
                    return
                } else if (cachedRole === "user") {
                    window.location.href = "/dashboard"
                    return
                }

                try {
                    const res = await fetch('/api/users/role', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: user.uid }),
                    })
                    if (res.ok) {
                        const data = await readApiJson(res)
                        const dbRole = data.role || "user"
                        localStorage.setItem("momentum_role", dbRole)
                        localStorage.setItem("momentum_user_id", user.uid)
                        window.location.href = dbRole === "recruiter" ? "/recruiter/dashboard" : "/dashboard"
                        return
                    }
                } catch (e) {
                    console.error("Auto login error on register:", e)
                }
            }
            setIsCheckingAutoLogin(false)
        })
        return () => unsubscribe()
    }, [])


    async function onSubmit(event: React.SyntheticEvent) {
        event.preventDefault()
        if (role === "recruiter" && !companyName.trim()) {
            setError("Company Name is required for recruiters.")
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            // Sync user to MongoDB
            const response = await fetch('/api/users/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    role: role,
                    companyName: role === "recruiter" ? companyName.trim() : undefined,
                }),
            })

            if (!response.ok) {
                const errorData = await readApiJson(response);
                throw new Error(errorData.detail || errorData.message || "Failed to sync user data.");
            }

            // Save role & session in localStorage for immediate auto-login
            localStorage.setItem("momentum_role", role)
            localStorage.setItem("momentum_user_id", user.uid)

            // Redirect to dashboard
            window.location.href = role === "recruiter" ? "/recruiter/dashboard" : "/dashboard"

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.")
            console.error("Registration error:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await signInWithPopup(auth, new GoogleAuthProvider())
            const user = result.user

            // Check if user already exists in DB
            const checkRes = await fetch('/api/users/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid }),
            })

            if (checkRes.ok) {
                const existingData = await readApiJson(checkRes)
                // If user is already in DB as recruiter:
                if (existingData.role === 'recruiter') {
                    localStorage.setItem("momentum_role", "recruiter")
                    localStorage.setItem("momentum_user_id", user.uid)
                    if (existingData.companyName) {
                        window.location.href = "/recruiter/dashboard"
                        return
                    }
                    // Recruiter without companyName: prompt for it
                    setGoogleUser(user)
                    setIsLoading(false)
                    setShowCompanyDialog(true)
                    return
                }

                // If user was job seeker in DB but registering on recruiter tab
                if (role === 'recruiter') {
                    localStorage.setItem("momentum_role", "recruiter")
                    localStorage.setItem("momentum_user_id", user.uid)
                    setGoogleUser(user)
                    setIsLoading(false)
                    setShowCompanyDialog(true)
                    return
                }

                localStorage.setItem("momentum_role", "user")
                localStorage.setItem("momentum_user_id", user.uid)
                window.location.href = "/dashboard"
                return
            }

            // User does not exist in DB yet
            if (role === 'recruiter') {
                localStorage.setItem("momentum_role", "recruiter")
                localStorage.setItem("momentum_user_id", user.uid)
                setGoogleUser(user)
                setIsLoading(false)
                setShowCompanyDialog(true)
                return
            }

            await syncGoogleUser(user)

        } catch (error: any) {
            console.error(error)
            setError(error.message)
            setIsLoading(false)
        }
    }

    const syncGoogleUser = async (user: FirebaseUser, cName?: string) => {
        try {
            const response = await fetch('/api/users/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || "Google User",
                    role: role,
                    companyName: cName,
                }),
            })

            if (!response.ok) {
                const errorData = await readApiJson(response);
                throw new Error(errorData.detail || errorData.message || "Failed to sync user data.");
            }

            localStorage.setItem("momentum_role", role)
            localStorage.setItem("momentum_user_id", user.uid)
            window.location.href = role === "recruiter" ? "/recruiter/dashboard" : "/dashboard"
        } catch (error: any) {
            console.error("Sync error:", error)
            setError(error.message)
            setIsLoading(false)
            setIsGoogleLoading(false)
        }
    }

    const handleCompanySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedCompany = googleCompanyName.trim()
        if (!googleUser || !trimmedCompany) {
            setError("Company name is required.");
            return;
        }

        setIsGoogleLoading(true);
        await syncGoogleUser(googleUser, trimmedCompany);
    }

    if (isCheckingAutoLogin) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white gap-4 relative overflow-hidden">
                <MomentumBackground />
                <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
                    <div className="h-12 w-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold tracking-tight">Authenticating with Momentum</h3>
                        <p className="text-sm text-slate-400">Checking your browser session...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950">

            {/* Full Screen Animated Background */}
            <div className="absolute inset-0 z-0">
                <MomentumBackground />
                <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" />
            </div>

            {/* Nav Back Button */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute left-4 top-4 z-50 md:left-8 md:top-8"
            >
                <Link
                    href="/"
                    className={cn(
                        "inline-flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-sm font-medium transition-all hover:bg-white/20 hover:text-white h-10 w-10 md:w-auto md:px-5 shadow-sm group text-white/80"
                    )}
                >
                    <ArrowLeft className="mr-0 md:mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="hidden md:inline">Back</span>
                </Link>
            </motion.div>

            {/* Centered Glass Card */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[500px] p-4 md:p-8"
            >
                {/* Brand Logo */}
                <div className="flex flex-col items-center justify-center mb-8 space-y-2">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40 border border-white/20">
                        <div className="h-6 w-6 bg-white rounded-full shadow-inner" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white shadow-sm">Momentum</h1>
                </div>

                <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-6 md:p-8 space-y-6">

                        <div className="text-center space-y-1.5">
                            <h2 className="text-2xl font-semibold text-white">Create an account</h2>
                            <p className="text-sm text-slate-300">Enter your details to get started</p>
                        </div>

                        {/* Role Switcher */}
                        <div className="grid grid-cols-2 gap-3 p-1 bg-black/20 rounded-xl">
                            <button
                                onClick={() => setRole("user")}
                                className={cn(
                                    "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    role === "user"
                                        ? "bg-indigo-600 text-white shadow-md relative overflow-hidden"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <span className={cn(role === "user" ? "relative z-10 flex items-center gap-2" : "flex items-center gap-2")}>
                                    <User className="h-4 w-4" />
                                    Job Seeker
                                </span>
                            </button>
                            <button
                                onClick={() => setRole("recruiter")}
                                className={cn(
                                    "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    role === "recruiter"
                                        ? "bg-indigo-600 text-white shadow-md relative overflow-hidden"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <span className={cn(role === "recruiter" ? "relative z-10 flex items-center gap-2" : "flex items-center gap-2")}>
                                    <Briefcase className="h-4 w-4" />
                                    Recruiter
                                </span>
                            </button>
                        </div>

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-200 ml-1">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    className="flex h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-black/30 placeholder:text-slate-500"
                                    disabled={isLoading}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            {role === "recruiter" && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="space-y-2"
                                >
                                    <label className="text-sm font-medium text-slate-200 ml-1">Company Name</label>
                                    <input
                                        type="text"
                                        placeholder="Acme Corp"
                                        className="flex h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-black/30 placeholder:text-slate-500"
                                        disabled={isLoading}
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        required={role === "recruiter"}
                                    />
                                </motion.div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-200 ml-1">Email</label>
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    className="flex h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-black/30 placeholder:text-slate-500"
                                    disabled={isLoading}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-200 ml-1">Password</label>
                                <input
                                    type="password"
                                    className="flex h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-black/30 placeholder:text-slate-500"
                                    disabled={isLoading}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {error && (
                                <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3">{error}</p>
                            )}

                            <Button className="w-full h-12 text-base font-semibold shadow-lg shadow-indigo-500/25 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-500/20 text-white transition-all hover:scale-[1.01]" disabled={isLoading}>
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Create Account
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-transparent px-2 text-slate-400">
                                    Or
                                </span>
                            </div>
                        </div>

                        <Button variant="outline" type="button" className="h-11 w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white transition-colors" disabled={isLoading} onClick={handleGoogleSignIn}>
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Mail className="mr-2 h-4 w-4" />
                            )}{" "}
                            Continue with Google
                        </Button>
                    </div>

                    <div className="bg-black/20 p-4 text-center border-t border-white/5">
                        <p className="text-xs text-slate-400">
                            Already have an account?{" "}
                            <Link href="/login" className="underline underline-offset-4 hover:text-indigo-400 font-medium text-slate-200 transition-colors">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>

            <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
                <DialogContent className="sm:max-w-[425px] bg-slate-900 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Complete Your Recruiter Profile</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Please enter your company name to finish setting up your account.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCompanySubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-200">Company Name</label>
                            <input
                                type="text"
                                placeholder="Acme Corp"
                                className="flex h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-black/30 placeholder:text-slate-500"
                                value={googleCompanyName}
                                onChange={(e) => setGoogleCompanyName(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                        {error && (
                            <p className="text-red-400 text-sm text-center font-medium">{error}</p>
                        )}
                        <DialogFooter>
                            <Button type="submit" disabled={isGoogleLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Complete Signup
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
