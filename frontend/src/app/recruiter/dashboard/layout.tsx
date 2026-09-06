"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
// Ensure these icons exist
import { LayoutDashboard, Users, Briefcase, PlusCircle, LogOut } from "lucide-react"
import { ModeToggle } from "@/components/ui/theme-toggle"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

export default function RecruiterDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [companyName, setCompanyName] = useState<string | null>(null)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const res = await fetch("/api/users/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uid: user.uid }),
                    })
                    if (res.ok) {
                        const data = await res.json()
                        if (data.companyName) setCompanyName(data.companyName)
                    }
                } catch (e) {}
            }
        })
        return () => unsubscribe()
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar - Distinct color for Recruiter */}
            <aside className="hidden w-64 flex-col border-r bg-slate-900 text-white md:flex">
                <div className="flex h-14 items-center border-b border-slate-700 px-6">
                    <Link href="/recruiter/dashboard" className="flex items-center gap-2 font-bold text-lg">
                        <div className="h-6 w-6 rounded-full bg-blue-500" />
                        <div className="flex flex-col">
                            <span className="leading-none text-base">Momentum</span>
                            <span className="text-[11px] font-normal text-blue-400 truncate max-w-[150px]">
                                {companyName || "Recruiter"}
                            </span>
                        </div>
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-6">
                    <nav className="grid items-start px-4 text-sm font-medium">
                        <NavItem href="/recruiter/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
                            Overview
                        </NavItem>
                        <NavItem href="/recruiter/dashboard/jobs/new" icon={<PlusCircle className="h-4 w-4" />}>
                            Post a Job
                        </NavItem>
                        <NavItem href="/recruiter/dashboard/candidates" icon={<Users className="h-4 w-4" />}>
                            Candidates
                        </NavItem>
                        <NavItem href="/recruiter/dashboard/jobs" icon={<Briefcase className="h-4 w-4" />}>
                            My Listings
                        </NavItem>
                    </nav>
                </div>
                <div className="mt-auto border-t border-slate-700 p-4">
                    <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-all hover:text-white">
                        <LogOut className="h-4 w-4" />
                        Log out
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-14 items-center justify-between border-b bg-background px-6">
                    <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-lg tracking-tight">Recruiter Portal</h2>
                        {companyName && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md font-medium border border-border/60">
                                {companyName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <ModeToggle />
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
                            M
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto bg-muted/10 p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}

function NavItem({ href, icon, children }: { href: string, icon: React.ReactNode, children: React.ReactNode }) {
    const pathname = usePathname()
    const isActive = pathname === href

    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-white mb-1",
                isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800"
            )}
        >
            {icon}
            {children}
        </Link>
    )
}
