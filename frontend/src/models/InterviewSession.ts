import mongoose from 'mongoose';


export interface IInterviewSession extends mongoose.Document {
    userId: string;
    topic: string;
    difficulty: string;
    createdAt: Date;
    completed_at?: Date;
    status?: string;
    report?: {
        domain_skill?: string;
        score?: number;
        understanding_score?: number;
        skills_score?: number;
        language_score?: number;
        ratings?: number;
        feedback?: string;
        improvements?: string;
    };
    interview_data?: Array<{
        question: string;
        answer: string;
        tone?: string;
        timestamp?: string;
    }>;
}

const InterviewSessionSchema = new mongoose.Schema<IInterviewSession>({
    userId: {
        type: String,
        required: [true, 'Please provide a userId.'],
    },
    topic: {
        type: String,
        required: [true, 'Please provide a topic.'],
    },
    difficulty: {
        type: String,
        required: [true, 'Please provide a difficulty level.'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    completed_at: Date,
    status: String,
    report: {
        domain_skill: String,
        score: Number,
        understanding_score: Number,
        skills_score: Number,
        language_score: Number,
        ratings: Number,
        feedback: String,
        improvements: String,
    },
    interview_data: [{
        question: String,
        answer: String,
        tone: String,
        timestamp: String,
    }],
});

export default mongoose.models.InterviewSession || mongoose.model<IInterviewSession>('InterviewSession', InterviewSessionSchema);
