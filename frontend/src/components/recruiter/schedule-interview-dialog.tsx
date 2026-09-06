"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Video, Bot, BrainCircuit, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface InterviewConfig {
    type: 'video' | 'ai-manual' | 'ai-auto';
    duration?: number;
    scheduleConfig?: {
        startDate: string;
        endDate: string;
        startTime: string;
        endTime: string;
    };
    deadline: string; // ISO string for date and time
    questions?: string[];
    aiTopic?: string;
    aiDifficulty?: 'Easy' | 'Medium' | 'Hard';
}

interface ScheduleInterviewDialogProps {
    jobId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialConfig?: InterviewConfig;
    onSave?: (config: InterviewConfig) => void;
}

export function ScheduleInterviewDialog({
    jobId,
    open,
    onOpenChange,
    initialConfig,
    onSave
}: ScheduleInterviewDialogProps) {
    const [step, setStep] = useState<1 | 2>(1)
    const [config, setConfig] = useState<InterviewConfig>({
        type: 'video',
        questions: [],
        aiDifficulty: 'Medium',
        scheduleConfig: {
            startDate: "",
            endDate: "",
            startTime: "",
            endTime: ""
        },
        deadline: ""
    })
    const [isLoading, setIsLoading] = useState(false)
    const [manualQuestions, setManualQuestions] = useState("")

    useEffect(() => {
        if (open) {
            setStep(1);
            if (initialConfig) {
                setConfig(initialConfig);
                if (initialConfig.questions) {
                    setManualQuestions(initialConfig.questions.join('\n'));
                }
            } else {
                // Reset to defaults
                setConfig({
                    type: 'video',
                    questions: [],
                    aiDifficulty: 'Medium',
                    duration: 30,
                    scheduleConfig: {
                        startDate: "",
                        endDate: "",
                        startTime: "09:00",
                        endTime: "17:00"
                    },
                    deadline: ""
                });
                setManualQuestions("");
            }
        }
    }, [open, initialConfig])


    const handleTypeSelect = (type: InterviewConfig['type']) => {
        setConfig(prev => ({ ...prev, type }))
        setStep(2)
    }

    const handleSave = async () => {
        if (!jobId) return;

        setIsLoading(true);
        try {
            // Prepare config
            const finalConfig = { ...config };
            if (config.type === 'ai-manual') {
                finalConfig.questions = manualQuestions.split('\n').filter(q => q.trim() !== "");
            }

            const res = await fetch(`/api/jobs/${jobId}/interview`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interviewConfig: finalConfig })
            });

            if (!res.ok) throw new Error("Failed to save interview configuration");

            const updatedJob = await res.json();
            if (onSave) onSave(finalConfig);
            onOpenChange(false);

        } catch (error) {
            console.error(error);
            // Handle error (toast, etc.)
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-slate-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Schedule Interview</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Configure how you want to interview candidates for this role.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {step === 1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <SelectionCard
                                icon={<Video className="h-8 w-8 text-blue-400" />}
                                title="Face-to-Face"
                                description="Auto-Schedule"
                                selected={config.type === 'video'}
                                onClick={() => handleTypeSelect('video')}
                            />
                            <SelectionCard
                                icon={<Bot className="h-8 w-8 text-purple-400" />}
                                title="AI Manual"
                                description="Your Questions"
                                selected={config.type === 'ai-manual'}
                                onClick={() => handleTypeSelect('ai-manual')}
                            />
                            <SelectionCard
                                icon={<BrainCircuit className="h-8 w-8 text-emerald-400" />}
                                title="AI Auto"
                                description="Auto-Generated"
                                selected={config.type === 'ai-auto'}
                                onClick={() => handleTypeSelect('ai-auto')}
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    {config.type === 'video' && <Video className="h-5 w-5 text-blue-400" />}
                                    {config.type === 'ai-manual' && <Bot className="h-5 w-5 text-purple-400" />}
                                    {config.type === 'ai-auto' && <BrainCircuit className="h-5 w-5 text-emerald-400" />}
                                    Configure {config.type === 'video' ? 'Face-to-Face' : config.type === 'ai-manual' ? 'Manual AI' : 'Auto AI'}
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-slate-400 hover:text-white">
                                    Change Type
                                </Button>
                            </div>

                            {config.type !== 'video' && (
                                <div className="space-y-4 border border-white/10 rounded-lg p-4 bg-black/20">
                                    <h4 className="font-semibold text-sm text-slate-300">Interview Deadline</h4>
                                    <div className="space-y-2">
                                        <Label>Complete By</Label>
                                        <div className="flex gap-4">
                                            <Input
                                                type="date"
                                                value={config.deadline ? new Date(config.deadline).toISOString().split('T')[0] : ""}
                                                onChange={(e) => {
                                                    const date = e.target.value;
                                                    const time = config.deadline ? new Date(config.deadline).toTimeString().slice(0, 5) : "23:59";
                                                    setConfig({ ...config, deadline: new Date(`${date}T${time}`).toISOString() });
                                                }}
                                                className="bg-black/20 border-white/10"
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                            <Input
                                                type="time"
                                                value={config.deadline ? new Date(config.deadline).toTimeString().slice(0, 5) : ""}
                                                onChange={(e) => {
                                                    const time = e.target.value;
                                                    const date = config.deadline ? new Date(config.deadline).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                                                    setConfig({ ...config, deadline: new Date(`${date}T${time}`).toISOString() });
                                                }}
                                                className="bg-black/20 border-white/10 w-32"
                                                min={config.deadline && new Date(config.deadline).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                                                    ? new Date().toTimeString().slice(0, 5)
                                                    : undefined}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Candidates must complete the interview by this date and time.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {config.type === 'video' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Interview Duration (Minutes)</Label>
                                        <Input
                                            type="number"
                                            placeholder="30"
                                            value={config.duration || ""}
                                            onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) || 0 })}
                                            className="bg-black/20 border-white/10"
                                        />
                                    </div>

                                    <div className="border border-white/10 rounded-lg p-4 bg-black/20 space-y-4">
                                        <h4 className="font-semibold text-sm text-slate-300">Availability Window</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Start Date</Label>
                                                <Input
                                                    type="date"
                                                    value={config.scheduleConfig?.startDate ? new Date(config.scheduleConfig.startDate).toISOString().split('T')[0] : ""}
                                                    onChange={(e) => setConfig({ ...config, scheduleConfig: { ...config.scheduleConfig!, startDate: e.target.value } })}
                                                    className="bg-black/20 border-white/10"
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Date</Label>
                                                <Input
                                                    type="date"
                                                    value={config.scheduleConfig?.endDate ? new Date(config.scheduleConfig.endDate).toISOString().split('T')[0] : ""}
                                                    onChange={(e) => setConfig({ ...config, scheduleConfig: { ...config.scheduleConfig!, endDate: e.target.value } })}
                                                    className="bg-black/20 border-white/10"
                                                    min={config.scheduleConfig?.startDate || new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Daily Start Time</Label>
                                                <Input
                                                    type="time"
                                                    value={config.scheduleConfig?.startTime || ""}
                                                    onChange={(e) => setConfig({ ...config, scheduleConfig: { ...config.scheduleConfig!, startTime: e.target.value } })}
                                                    className="bg-black/20 border-white/10"
                                                    min={config.scheduleConfig?.startDate && new Date(config.scheduleConfig.startDate).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                                                        ? new Date().toTimeString().slice(0, 5)
                                                        : undefined}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Daily End Time</Label>
                                                <Input
                                                    type="time"
                                                    value={config.scheduleConfig?.endTime || ""}
                                                    onChange={(e) => setConfig({ ...config, scheduleConfig: { ...config.scheduleConfig!, endTime: e.target.value } })}
                                                    className="bg-black/20 border-white/10"
                                                    min={config.scheduleConfig?.startTime}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            The system will automatically generate {config.duration} min slots within these hours for all pending applicants.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {config.type === 'ai-manual' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Interview Questions (One per line)</Label>
                                        <textarea
                                            className="flex min-h-[150px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                                            placeholder="1. Tell me about yourself.&#10;2. What are your strengths?"
                                            value={manualQuestions}
                                            onChange={(e) => setManualQuestions(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {config.type === 'ai-auto' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Topic / Tech Stack</Label>
                                        <Input
                                            placeholder="e.g. React, Python, Digital Marketing"
                                            value={config.aiTopic || ""}
                                            onChange={(e) => setConfig({ ...config, aiTopic: e.target.value })}
                                            className="bg-black/20 border-white/10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Difficulty Level</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                                            value={config.aiDifficulty || "Medium"}
                                            onChange={(e) => setConfig({ ...config, aiDifficulty: e.target.value as any })}
                                        >
                                            <option value="Easy">Easy</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Hard">Hard</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between">
                    {step === 2 && (
                        <Button variant="ghost" onClick={() => setStep(1)} disabled={isLoading}>Back</Button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="border-white/10 hover:bg-white/5 hover:text-white">Cancel</Button>
                        {step === 2 && (
                            <Button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Configuration
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SelectionCard({ icon, title, description, selected, onClick }: { icon: React.ReactNode, title: string, description: string, selected: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "cursor-pointer rounded-xl border-2 p-6 flex flex-col items-center justify-center gap-3 text-center transition-all duration-200 hover:border-indigo-500/50 hover:bg-white/5",
                selected ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 bg-black/20"
            )}
        >
            {icon}
            <div>
                <h4 className="font-semibold text-white">{title}</h4>
                <p className="text-xs text-slate-400">{description}</p>
            </div>
            {selected && <CheckCircle2 className="h-5 w-5 text-indigo-500 absolute top-2 right-2 opacity-0" />}
        </div>
    )
}
