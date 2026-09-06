"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ProblemsClient from "./client";
import { Loader2 } from "lucide-react";

export default function ProblemsPage() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const res = await fetch(`/api/problems?userId=${currentUser.uid}`);
          if (res.ok) {
            const data = await res.json();
            setProblems(data);
          }
        } catch (error) {
          console.error("Failed to fetch problems:", error);
        }
      } else {
        // Maybe fetch public problems or clear list?
        // For now, let's show empty or prompt login.
        setProblems([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex bg-muted/20 h-[80vh] items-center justify-center rounded-xl border-2 border-dashed">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Please Log In</h2>
          <p className="text-muted-foreground">You need to be signed in to view and generate problems.</p>
        </div>
      </div>
    )
  }

  return <ProblemsClient initialProblems={problems} userId={user.uid} />;
}
