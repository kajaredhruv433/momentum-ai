"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, MapPin, Clock, Users, MoreHorizontal, Edit2, Trash2, Eye, PlusCircle, Search, Filter } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"

import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from "firebase/auth";

export default function MyJobsPage() {
    const [jobs, setJobs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        const fetchJobs = async (uid: string) => {
            try {
                // Fetch all jobs first to debug visibility
                const res = await fetch(`/api/jobs`)
                const data = await res.json()

                // Filter locally to ensure exact match
                const myJobs = data.filter((job: any) => job.recruiterUid === uid);
                setJobs(myJobs)
            } catch (error) {
                console.error("Failed to fetch jobs:", error)
            } finally {
                setIsLoading(false)
            }
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchJobs(user.uid);
            } else {
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, [])

    const filteredJobs = jobs.filter(job =>
        (job.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.location || "").toLowerCase().includes(searchQuery.toLowerCase())
    )


    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">My Job Listings</h1>
                    <p className="text-muted-foreground">Manage your active and past job postings.</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 px-6 py-5 rounded-xl font-bold" asChild>
                    <Link href="/recruiter/dashboard/jobs/new">
                        <PlusCircle className="mr-2 h-5 w-5" /> Post New Job
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search jobs by title or location..."
                        className="pl-10 h-11 rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="h-11 px-6 rounded-xl border-dashed">
                    <Filter className="mr-2 h-4 w-4" /> Filter
                </Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-[250px] rounded-2xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : filteredJobs.length === 0 ? (
                <Card className="border-dashed py-20 bg-muted/5 flex flex-col items-center justify-center text-center">
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                        <Briefcase className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-2xl font-bold mb-2">No jobs found</CardTitle>
                    <CardDescription className="max-w-xs mx-auto mb-8">
                        {searchQuery ? "Try adjusting your search query." : "You haven't posted any jobs yet. Start by creating a new job listing."}
                    </CardDescription>
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link href="/recruiter/dashboard/jobs/new">Post Your First Job</Link>
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredJobs.map((job, index) => (
                            <motion.div
                                key={job._id || index}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="group border-none shadow-xl hover:shadow-2xl transition-all h-full bg-gradient-to-br from-background to-muted/20 relative overflow-hidden group flex flex-col">
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Active</Badge>
                                    </div>
                                    <CardHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                                <Briefcase className="h-5 w-5" />
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{job.type}</span>
                                        </div>
                                        <CardTitle className="text-xl group-hover:text-blue-600 transition-colors line-clamp-1">{job.title}</CardTitle>
                                        <CardDescription className="flex items-center gap-4 mt-2 font-medium">
                                            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                                            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {new Date(job.postedAt).toLocaleDateString()}</span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 flex-1">
                                        <div className="p-4 rounded-xl bg-background shadow-inner border border-border/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-muted-foreground">Applications</span>
                                                <span className="text-lg font-black text-foreground">{job.counter || 0}</span>
                                            </div>
                                            <div className="w-full h-2 bg-muted rounded-full">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min((job.counter || 0) * 10, 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="outline" size="sm" className="rounded-lg h-9 font-bold bg-white dark:bg-slate-900 hover:bg-blue-600 hover:text-white transition-all">
                                                <Users className="mr-2 h-4 w-4" /> Applicants
                                            </Button>
                                            <Button variant="outline" size="sm" className="rounded-lg h-9 font-bold bg-white dark:bg-slate-900">
                                                <Eye className="mr-2 h-4 w-4" /> View Page
                                            </Button>
                                        </div>
                                    </CardContent>
                                    <div className="px-6 py-4 bg-muted/10 border-t flex justify-between items-center group-hover:bg-muted/30 transition-colors mt-auto">
                                        <p className="text-sm font-bold text-blue-600">{job.salary}</p>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}

