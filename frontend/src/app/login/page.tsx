"use client"

import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MomentumBackground } from "@/components/ui/momentum-background"
import { Loader2, Mail, Briefcase, User } from "lucide-react"
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, User as FirebaseUser } from "firebase/auth"
import { auth } from "@/lib/firebase"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [role, setRole] = useState<"user" | "recruiter">("user")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)

    // State for Recruiter Company Name Modal (e.g. Google Login or missing profile)
    const [showCompanyDialog, setShowCompanyDialog] = useState(false)
    const [pendingUser, setPendingUser] = useState<FirebaseUser | null>(null)
    const [companyNameInput, setCompanyNameInput] = useState("")
    const [isCompanyLoading, setIsCompanyLoading] = useState(false)
    const [companyDialogError, setCompanyDialogError] = useState<string | null>(null)

    async function onSubmit(event: React.SyntheticEvent) {
        event.preventDefault()
        setIsLoading(true)
        setError(null)
        setCompanyDialogError(null)

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            // Fetch true role from DB
            const res = await fetch('/api/users/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid }),
            })

            if (res.ok) {
                const data = await res.json()
                const dbRole = data.role
                if (dbRole === "recruiter") {
                    if (!data.companyName) {
                        setPendingUser(user)
                        setIsLoading(false)
                        setShowCompanyDialog(true)
                        return
                    }
                    window.location.href = "/recruiter/dashboard"
                    return
                }
                window.location.href = "/dashboard"
            } else {
                window.location.href = "/dashboard"
            }
        } catch (error: any) {
            console.error(error)
            setError("Invalid email or password")
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        setError(null)
        setCompanyDialogError(null)
        try {
            const result = await signInWithPopup(auth, new GoogleAuthProvider())
            const user = result.user

            const resCheck = await fetch('/api/users/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid }),
            })

            if (resCheck.ok) {
                const data = await resCheck.json()
                // If user is already registered as recruiter
                if (data.role === "recruiter") {
                    if (data.companyName) {
                        window.location.href = "/recruiter/dashboard"
                        return
                    }
                    // Missing company name: prompt for it!
                    setPendingUser(user)
                    setIsLoading(false)
                    setShowCompanyDialog(true)
                    return
                }

                // If user chose recruiter tab on login page
                if (role === "recruiter") {
                    if (data.companyName) {
                        window.location.href = "/recruiter/dashboard"
                        return
                    }
                    setPendingUser(user)
                    setIsLoading(false)
                    setShowCompanyDialog(true)
                    return
                }

                window.location.href = "/dashboard"
                return
            } else {
                // User does not exist in DB yet
                if (role === "recruiter") {
                    setPendingUser(user)
                    setIsLoading(false)
                    setShowCompanyDialog(true)
                    return
                }

                await fetch('/api/users/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || "Google User",
                        role: "user",
                    }),
                })
                window.location.href = "/dashboard"
            }
        } catch (error: any) {
            console.error(error)
            setError(error.message)
            setIsLoading(false)
        }
    }

    const handleCompanySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = companyNameInput.trim()
        if (!pendingUser || !trimmed) {
            setCompanyDialogError("Please enter your company name.")
            return
        }

        setIsCompanyLoading(true)
        setCompanyDialogError(null)

        try {
            const res = await fetch('/api/users/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: pendingUser.uid,
                    email: pendingUser.email,
                    name: pendingUser.displayName || "Recruiter",
                    role: "recruiter",
                    companyName: trimmed,
                }),
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.detail || errData.message || "Failed to save company name.")
            }

            window.location.href = "/recruiter/dashboard"
        } catch (err: any) {
            console.error("Failed to submit company name:", err)
            setCompanyDialogError(err.message || "Failed to save company name.")
            setIsCompanyLoading(false)
        }
    }

    return (
        <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-background overflow-hidden">


            {/* Left Panel - Custom Pro Animated Visual */}
            <div className="relative hidden h-full flex-col bg-slate-950 text-white lg:flex border-r border-slate-800">

                {/* Custom Animated Background */}
                <MomentumBackground />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 z-10" />

                {/* Content */}
                <div className="relative z-20 p-10 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/10">
                        <div className="h-5 w-5 bg-white rounded-full shadow-inner" />
                    </div>
                    <span className="text-2xl font-bold tracking-wide">Momentum</span>
                </div>

                {/* Centered Text with GLOW Effect */}
                <div className="relative z-20 flex flex-1 flex-col items-center justify-center p-12 max-w-xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="space-y-8"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
                            Build momentum. <br />
                            <span className="animate-text-shimmer bg-[linear-gradient(110deg,#93aec1,45%,#ffffff,55%,#93aec1)] bg-[length:250%_100%] bg-clip-text text-transparent">
                                Master your future.
                            </span>
                        </h2>

                        <div className="h-1 w-20 bg-indigo-500 rounded-full mx-auto" />

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0, duration: 1 }}
                            className="text-xl text-slate-300 font-light leading-relaxed italic"
                        >
                            &ldquo;The platform effectively bridges the gap between potential and opportunity.&rdquo;
                        </motion.p>
                    </motion.div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="lg:p-8 relative flex items-center justify-center h-full bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[420px] p-8"
                >
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Welcome
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Sign in to your account
                        </p>
                    </div>

                    {/* Role Toggles */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setRole("user")}
                            className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 gap-2 hover:scale-[1.02] active:scale-[0.98]",
                                role === "user"
                                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 shadow-sm"
                                    : "border-border/50 bg-background text-muted-foreground hover:border-indigo-200 hover:bg-muted/50"
                            )}
                        >
                            <User className="h-6 w-6 mb-1" />
                            <span className="text-sm font-semibold">Job Seeker</span>
                        </button>
                        <button
                            onClick={() => setRole("recruiter")}
                            className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 gap-2 hover:scale-[1.02] active:scale-[0.98]",
                                role === "recruiter"
                                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 shadow-sm"
                                    : "border-border/50 bg-background text-muted-foreground hover:border-indigo-200 hover:bg-muted/50"
                            )}
                        >
                            <Briefcase className="h-6 w-6 mb-1" />
                            <span className="text-sm font-semibold">Recruiter</span>
                        </button>
                    </div>

                    <div className="grid gap-6">
                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Email</label>
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-transparent"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium leading-none">Password</label>
                                    <Link href="#" className="text-xs text-indigo-600 hover:underline font-medium">Forgot password?</Link>
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-transparent"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm text-center">{error}</p>
                            )}

                            <Button className="w-full h-11 text-base font-semibold shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-[1.01]" disabled={isLoading}>
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Sign In
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Or continue with
                                </span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            type="button"
                            className="h-11 w-full hover:bg-slate-50 dark:hover:bg-slate-900"
                            disabled={isLoading}
                            onClick={handleGoogleLogin}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                </svg>
                            )}{" "}
                            Sign in with Google
                        </Button>
                    </div>

                    <p className="px-8 text-center text-xs text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="underline underline-offset-4 hover:text-indigo-600 font-medium text-foreground transition-colors">
                            Sign up
                        </Link>
                    </p>
                </motion.div>
            </div>

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
                                value={companyNameInput}
                                onChange={(e) => setCompanyNameInput(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                        {companyDialogError && (
                            <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3">{companyDialogError}</p>
                        )}
                        <DialogFooter>
                            <Button type="submit" disabled={isCompanyLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                {isCompanyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Continue to Dashboard
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
