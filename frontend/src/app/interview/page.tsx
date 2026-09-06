"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function InterviewRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/dashboard/interviews")
    }, [router])

    return null
}
