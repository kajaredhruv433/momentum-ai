import mongoose from 'mongoose';

export interface IApplication extends mongoose.Document {
    jobId: mongoose.Schema.Types.ObjectId;
    applicantUid: string; // Firebase UID of the applicant (User)
    recruiterUid: string; // Firebase UID of the recruiter who posted the job
    applicantName: string; // Snapshot for easier display
    applicantEmail: string; // Snapshot for easier display
    jobTitle: string; // Snapshot for easier display
    status: 'Applied' | 'Screening' | 'Interviewing' | 'Offer' | 'Rejected';
    coverNote?: string;
    score?: number; // AI Score
    aiReview?: string; // AI Feedback
    appliedAt: Date;
}

const ApplicationSchema = new mongoose.Schema<IApplication>({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    applicantUid: {
        type: String,
        required: true,
    },
    recruiterUid: {
        type: String,
        required: true,
    },
    applicantName: {
        type: String,
        required: true
    },
    applicantEmail: {
        type: String,
        required: true
    },
    jobTitle: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'],
        default: 'Applied',
    },
    coverNote: {
        type: String,
        required: false
    },
    score: {
        type: Number,
        default: 0
    },
    aiReview: {
        type: String,
        required: false
    },
    appliedAt: {
        type: Date,
        default: Date.now,
    },
});

// Force recompilation in dev to pick up schema changes
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Application;
}

export default mongoose.models.Application || mongoose.model<IApplication>('Application', ApplicationSchema);
