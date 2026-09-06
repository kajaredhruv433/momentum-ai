"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { auth } from "@/lib/firebase"
import { Loader2, Radio } from "lucide-react"

export default function InterviewRoomPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <InterviewRedirector />
        </Suspense>
    )
}

function LoadingFallback() {
    return (
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 text-slate-300">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-lg font-medium">Connecting to EchoSphere AI Interview Room...</p>
        </div>
    )
}

function InterviewRedirector() {
    const searchParams = useSearchParams()

    useEffect(() => {
        const jobId = searchParams.get("jobId") || searchParams.get("job_id") || ""
        const applicationId = searchParams.get("applicationId") || searchParams.get("appId") || ""
        const user = auth.currentUser
        const email = user?.email || searchParams.get("candidateEmail") || ""
        const uid = user?.uid || searchParams.get("candidateId") || ""

        const query = new URLSearchParams()
        if (jobId) query.set("jobId", jobId)
        if (applicationId) query.set("applicationId", applicationId)
        if (email) query.set("candidateEmail", email)
        if (uid) query.set("candidateId", uid)

        // Redirect directly to the full native EchoSphere v9 interview experience
        const targetUrl = `http://localhost:8000/?${query.toString()}`
        window.location.href = targetUrl
    }, [searchParams])

    return (
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 text-slate-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                <Radio className="h-8 w-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">Launching AI Interview</h2>
            <p className="text-sm text-slate-400">Retrieving job requirements and candidate profile from MongoDB...</p>
            <Loader2 className="h-6 w-6 animate-spin text-blue-500 mt-2" />
        </div>
    )
}
