"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RecruiterInterviewsRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/recruiter/dashboard")
    }, [router])

    return null
}
