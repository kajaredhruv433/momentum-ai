"use client"

import { useEffect, useRef } from "react"

export function MomentumBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let animationFrameId: number
        let particles: Particle[] = []

        const resize = () => {
            canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
            canvas.height = canvas.parentElement?.clientHeight || window.innerHeight
        }

        class Particle {
            x: number
            y: number
            size: number
            speedX: number
            speedY: number
            opacity: number
            color: string

            constructor() {
                this.x = Math.random() * canvas!.width
                this.y = Math.random() * canvas!.height + canvas!.height // Start below
                this.size = Math.random() * 2 + 0.5
                this.speedX = (Math.random() - 0.5) * 0.5
                this.speedY = Math.random() * -1 - 0.2 // Always moving up
                this.opacity = Math.random() * 0.5 + 0.1

                // Momentum Palette: Blue, Violet, Indigo, White
                const colors = ["147, 197, 253", "167, 139, 250", "129, 140, 248", "255, 255, 255"]
                this.color = colors[Math.floor(Math.random() * colors.length)]
            }

            update() {
                this.x += this.speedX
                this.y += this.speedY

                // Reset if off screen
                if (this.y < -10) {
                    this.y = canvas!.height + 10
                    this.x = Math.random() * canvas!.width
                }
            }

            draw() {
                if (!ctx) return
                ctx.beginPath()
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`
                ctx.fill()
            }
        }

        const init = () => {
            particles = []
            // Density
            const particleCount = Math.floor((canvas.width * canvas.height) / 8000)
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle())
                // Randomize starting Y to fill screen immediately
                particles[i].y = Math.random() * canvas.height
            }
        }

        const animate = () => {
            if (!ctx) return
            ctx.fillStyle = "rgba(2, 6, 23, 0.2)" // Fade effect (Slate-950)
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            particles.forEach((particle) => {
                particle.update()
                particle.draw()
            })

            // Draw subtle connecting lines for "Network" feel (close particles only)
            // Optimization: Only check a subset or use loop carefully. 
            // For performance in this demo, we'll skip complex N^2 line drawing and focus on flow.

            animationFrameId = requestAnimationFrame(animate)
        }

        window.addEventListener("resize", resize)
        resize()
        init()
        animate()

        return () => {
            window.removeEventListener("resize", resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full bg-slate-950"
            style={{ filter: 'blur(0px)' }}
        />
    )
}
