"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code2, FileText, CheckCircle, Orbit, Zap, Shield, Sparkles } from "lucide-react"

export default function LandingPage() {
  const [stars, setStars] = useState<any[]>([])
  const [shootingStars, setShootingStars] = useState<any[]>([])

  useEffect(() => {
    // Generate stars
    const newStars = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 1}px`,
      duration: `${Math.random() * 3 + 2}s`,
      delay: `${Math.random() * 5}s`
    }))
    setStars(newStars)

    // Generate shooting stars
    const newShootingStars = Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 50}%`,
      left: `${Math.random() * 50}%`,
      delay: `${Math.random() * 10}s`
    }))
    setShootingStars(newShootingStars)
  }, [])

  return (
    <div className="relative min-h-screen flex flex-col text-white selection:bg-primary/30">
      {/* Starry Background */}
      <div className="stars-wrapper">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              "--duration": star.duration,
              animationDelay: star.delay
            } as any}
          />
        ))}
        {shootingStars.map((s) => (
          <div
            key={s.id}
            className="shooting-star"
            style={{
              "--top": s.top,
              "--left": s.left,
              "--delay": s.delay
            } as any}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0c0d13]" />
      </div>

      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 px-6 py-4">
        <nav className="max-w-7xl mx-auto flex items-center justify-between glass rounded-2xl px-6 py-3 border-white/5 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Orbit className="h-5 w-5 text-white animate-pulse" />
            </div>
            <span className="text-xl font-bold tracking-tighter text-glow">MOMENTUM</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#recruiters" className="hover:text-white transition-colors">Recruiters</Link>
            <Link href="#about" className="hover:text-white transition-colors">About</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-sm font-medium hover:text-blue-400 transition-colors">Sign In</Link>
            <Button asChild variant="default" className="bg-white text-black hover:bg-white/90 rounded-xl px-6 font-semibold shadow-lg">
              <Link href="/login">Launch App</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-48 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-white/10 text-xs font-semibold tracking-widest uppercase text-blue-400 mb-4 animate-bounce">
                <Sparkles className="h-3 w-3" /> The Future of Career Growth
              </div>

              <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] text-glow bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                Build Your Momentum.<br />
                <span className="text-blue-500">Master Your Future.</span>
              </h1>

              <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 leading-relaxed font-light">
                Accelerate your career journey with AI-powered resume building,
                standardized profiles, and real-time interview coaching.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10">
                <Button asChild size="lg" className="h-14 px-10 text-lg rounded-2xl bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/20 group transition-all duration-300">
                  <Link href="/register" className="flex items-center gap-2">
                    Start My Journey
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-10 text-lg rounded-2xl glass border-white/10 hover:bg-white/5 transition-all">
                  <Link href="/register">
                    I'm a Recruiter
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything You Need</h2>
              <p className="text-white/40 max-w-xl mx-auto font-light">One unified platform to take you from a messy resume to a top-tier candidate.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <FeatureCard
                icon={<Zap className="h-8 w-8 text-yellow-400" />}
                title="AI-Driven Insights"
                description="Get real-time feedback on your skills and performance to identify gaps before the real interview."
                delay={0.1}
              />
              <FeatureCard
                icon={<FileText className="h-8 w-8 text-blue-400" />}
                title="Standardized Profiles"
                description="Create ATS-proof resumes that stand out to recruiters with consistent, clean formatting."
                delay={0.2}
              />
              <FeatureCard
                icon={<Shield className="h-8 w-8 text-green-400" />}
                title="Secure Hiring"
                description="A trust-based ecosystem where recruiters find verified talent through deep AI assessment."
                delay={0.3}
              />
            </div>
          </div>
        </section>

        {/* Recruiter CTA */}
        <section id="recruiters" className="py-24 bg-white/[0.02] border-y border-white/5 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
                Optimized for <br />
                <span className="text-blue-500">Recruiters.</span>
              </h2>
              <p className="text-lg text-white/50 leading-relaxed font-light">
                Stop browsing through unorganized resumes. Momentum provides standardized profiles
                with built-in AI ratings, making your hiring process 10x faster and more reliable.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  <span>AI Relevance Scoring by Domain</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  <span>Comprehensive Performance Analytics</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  <span>Standardized Global Formats</span>
                </div>
              </div>
              <Button asChild size="lg" className="rounded-xl h-12 bg-white text-black hover:bg-white/90">
                <Link href="/register">Recruiter Dashboard</Link>
              </Button>
            </div>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative glass rounded-2xl p-8 border-white/10 aspect-video flex flex-col justify-center gap-4">
                <div className="h-2 w-1/4 bg-blue-500/20 rounded-full animate-pulse" />
                <div className="h-2 w-full bg-white/5 rounded-full" />
                <div className="h-2 w-3/4 bg-white/5 rounded-full" />
                <div className="h-2 w-1/2 bg-white/5 rounded-full" />
                <div className="mt-8 flex gap-2">
                  <div className="h-8 w-20 bg-blue-500/10 rounded-lg" />
                  <div className="h-8 w-20 bg-blue-500/10 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-pointer">
            <Orbit className="h-6 w-6 text-blue-500" />
            <span className="font-bold tracking-tighter">MOMENTUM</span>
          </div>
          <div className="flex gap-10 text-sm text-white/30 font-medium">
            <Link href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">Contact Us</Link>
          </div>
          <p className="text-sm text-white/20">© 2026 Momentum Platform. Built for the future.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="group relative p-8 rounded-3xl glass border-white/5 hover:border-blue-500/20 transition-all duration-500"
    >
      <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/[0.02] rounded-3xl transition-colors duration-500" />
      <div className="relative space-y-4">
        <div className="p-3 rounded-2xl bg-white/5 w-fit group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="text-white/40 font-light text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}
