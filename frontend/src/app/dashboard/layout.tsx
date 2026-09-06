"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Code2, FileText, Video, Briefcase, Settings, LogOut, Flame, Sparkles, Trophy } from "lucide-react"
import { ModeToggle } from "@/components/ui/theme-toggle"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside className="hidden w-64 flex-col border-r bg-card md:flex">
                <div className="flex h-14 items-center border-b px-6">
                    <Link href="/dashboard" className="flex items-center gap-3 font-bold text-xl tracking-tight">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <span className="text-xl font-black italic">M</span>
                        </div>
                        <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Momentum</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-6">
                    <nav className="grid items-start px-4 text-sm font-medium">
                        <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
                            Overview
                        </NavItem>
                        <NavItem href="/dashboard/problems" icon={<Code2 className="h-4 w-4" />}>
                            Solve Problems
                        </NavItem>
                        <NavItem href="/dashboard/resume" icon={<FileText className="h-4 w-4" />}>
                            Resume Updates
                        </NavItem>
                        <NavItem href="/dashboard/interviews" icon={<Video className="h-4 w-4" />}>
                            Interviews
                        </NavItem>
                        <NavItem href="/dashboard/jobs" icon={<Briefcase className="h-4 w-4" />}>
                            Jobs
                        </NavItem>
                        <NavItem href="/dashboard/settings" icon={<Settings className="h-4 w-4" />}>
                            Settings
                        </NavItem>
                    </nav>
                </div>
                <div className="mt-auto border-t p-4">
                    <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground">
                        <LogOut className="h-4 w-4" />
                        Log out
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Header with Progress/Streak */}
                <header className="flex h-16 items-center justify-between border-b bg-background px-6">
                    <div className="flex items-center gap-4">
                        {/* Progress / Date Display matches 'date and day at the top' */}
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                            </span>
                            <span className="text-lg font-bold leading-none">
                                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm font-medium shadow-sm hover:scale-105 transition-transform cursor-pointer group relative">
                            <Flame className="h-4 w-4 text-orange-500 fill-orange-500 animate-pulse" />
                            <span>0 Day streak</span>
                            <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-popover border rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                                <p className="text-xs font-bold mb-1 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-yellow-500" /> Reward Active
                                </p>
                                <p className="text-[10px] text-muted-foreground leading-tight">Complete today's goal to reach 1 day and earn a Power Star!</p>
                            </div>
                        </div>
                        <ModeToggle />
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
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-foreground mb-1",
                isActive
                    ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                    : "text-muted-foreground"
            )}
        >
            {icon}
            {children}
        </Link>
    )
}
