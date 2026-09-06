import mongoose from 'mongoose';

export interface ICandidate extends mongoose.Document {
    name: string;
    role: string;
    targetCompany: string;
    applied: Date;
    score: number;
    status: string;
    skills: string;
    summary: string;
    feedback: string;
    resumeData: any; // Storing the full JSON object
}

const CandidateSchema = new mongoose.Schema<ICandidate>({
    name: {
        type: String,
        required: [true, 'Please provide a candidate name.'],
    },
    role: {
        type: String,
        default: 'General',
    },
    targetCompany: {
        type: String,
        default: 'General',
    },
    applied: {
        type: Date,
        default: Date.now,
    },
    score: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        default: 'New',
    },
    skills: {
        type: String,
        default: '',
    },
    summary: {
        type: String,
        default: '',
    },
    feedback: {
        type: String,
        default: '',
    },
    resumeData: {
        type: mongoose.Schema.Types.Mixed, // Storing flexible JSON data for resume
        default: {},
    },
});

export default mongoose.models.Candidate || mongoose.model<ICandidate>('Candidate', CandidateSchema);
