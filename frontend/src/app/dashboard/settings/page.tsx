"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Bell, Shield, Github, Globe } from "lucide-react"

import { useState, useEffect } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth"

export default function SettingsPage() {
    const [user, setUser] = useState<FirebaseUser | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            setLoading(false)
        })
        return () => unsubscribe()
    }, [])

    const displayName = user?.displayName || user?.email?.split('@')[0] || "User"
    const initial = displayName.charAt(0).toUpperCase()
    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>This is how others will see you on the site.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                            {initial}
                        </div>
                        <Button variant="outline">Change Avatar</Button>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Display Name</label>
                        <input
                            key={displayName}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            defaultValue={displayName}
                            placeholder="Enter your name"
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Bio</label>
                        <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Tell us about yourself"
                        />
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button>Save Changes</Button>
                </CardFooter>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Account Security</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</div>
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-medium">{user?.email}</span>
                                <span className="text-xs text-muted-foreground">{user?.emailVerified ? "Verified" : "Unverified"}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Password</div>
                            <Button variant="link" className="px-0 h-auto">Update</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Connected Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Github className="h-4 w-4" /> GitHub</div>
                            <span className="text-sm text-green-600">Connected</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Globe className="h-4 w-4" /> Google</div>
                            <span className="text-sm text-green-600">Connected</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
