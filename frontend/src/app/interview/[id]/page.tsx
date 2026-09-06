"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Video, VideoOff, MicOff, MonitorUp, AlertCircle } from "lucide-react"
import { useParams, useRouter } from "next/navigation"

export default function InterviewSession() {
    const params = useParams()
    const router = useRouter()
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [question, setQuestion] = useState("Tell me about a time you faced a difficult technical challenge and how you solved it.")
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Webcam Setup
    useEffect(() => {
        async function setupCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                }
            } catch (err) {
                console.error("Error accessing camera:", err)
            }
        }
        setupCamera()

        // Cleanup
        return () => {
            // Stop tracks logic would go here
        }
    }, [])

    // Fullscreen Logic
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true))
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false))
        }
    }

    const handleFinish = () => {
        // Simulate navigation to report
        router.push("/dashboard/interviews/report/123")
    }

    return (
        <div className="flex h-screen flex-col bg-background relative overflow-hidden">
            {/* Anti-cheat overlay if not fullscreen */}
            {!isFullscreen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
                    <div className="text-center space-y-4 max-w-md p-6 border bg-card rounded-xl shadow-2xl">
                        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                        <h2 className="text-2xl font-bold">Anti-Cheat Check</h2>
                        <p className="text-muted-foreground">To ensure interview integrity, you must enable Fullscreen mode. Background apps should be closed.</p>
                        <Button size="lg" onClick={toggleFullscreen} className="w-full">
                            Enter Fullscreen & Start
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex gap-4 p-4">
                {/* Main Interview Area */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* AI Avatar / Question Area */}
                    <div className="flex-1 rounded-xl bg-muted/30 border flex flex-col items-center justify-center p-8 text-center relative">
                        <div className="h-24 w-24 rounded-full bg-primary/20 animate-pulse mb-6 flex items-center justify-center">
                            <div className="h-20 w-20 rounded-full bg-primary/40 animate-ping" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2">{question}</h2>
                        <p className="text-muted-foreground">AI Interviewer is listening...</p>
                    </div>

                    {/* Controls */}
                    <div className="h-24 rounded-xl border bg-card flex items-center justify-between px-8">
                        <div className="flex gap-4">
                            <Button variant="outline" size="icon"><Mic className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon"><Video className="h-4 w-4" /></Button>
                            <Button variant="outline" onClick={() => setQuestion("Can you elaborate on the scalability aspect?")}>
                                Next Question (Demo)
                            </Button>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-red-500 font-mono animate-pulse">
                                <span className="h-3 w-3 rounded-full bg-red-500" />
                                REC 00:42
                            </div>
                            <Button variant="destructive" onClick={handleFinish}>Finish Interview</Button>
                        </div>
                    </div>
                </div>

                {/* User Preview (PIP style) */}
                <div className="w-80 flex flex-col gap-4">
                    <div className="aspect-video rounded-xl bg-black border border-gray-800 overflow-hidden relative shadow-2xl">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 rounded">You</div>
                    </div>

                    {/* Live Transcription / Notes */}
                    <div className="flex-1 rounded-xl border bg-card p-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <MonitorUp className="h-4 w-4" /> Live Analysis
                        </h3>
                        <div className="space-y-2 text-sm text-muted-foreground h-full overflow-y-auto">
                            <p className="text-green-500">✔ Good eye contact detected.</p>
                            <p className="text-yellow-500">⚠ Speaking too fast (180 wpm).</p>
                            <p className="text-green-500">✔ Key term "Microservices" mentioned.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
