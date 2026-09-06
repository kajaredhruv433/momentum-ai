import mongoose from 'mongoose';

export interface IJob extends mongoose.Document {
    title: string;
    roleRequired?: string;
    description: string;
    location: string;
    type: string;
    salary: string;
    company: string;
    skillsRequired?: string[];
    experience?: string;
    qualification?: string;
    employeeQualities?: string;
    roleDocument?: {
        name: string;
        type: string;
        size: number;
        data: string;
    };
    recruiterUid: string;
    recruiterEmail: string;
    postedAt: Date;
    counter: number;
    applicants: {
        uid: string;
        name: string;
    }[];
    interviewConfig?: {
        type: 'video' | 'ai-manual' | 'ai-auto';
        duration?: number;
        scheduleConfig?: {
            startDate: Date;
            endDate: Date;
            startTime: string;
            endTime: string;
        };
        deadline?: Date;
        slots?: {
            date: string;
            time: string;
            isBooked: boolean;
            candidateId?: string;
            applicationId?: string;
        }[];
        questions?: string[];
        aiTopic?: string;
        aiDifficulty?: 'Easy' | 'Medium' | 'Hard';
    };
}

const JobSchema = new mongoose.Schema<IJob>({
    title: {
        type: String,
        required: [true, 'Please provide a job title.'],
    },
    roleRequired: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        required: [true, 'Please provide a job description.'],
    },
    location: {
        type: String,
        required: [true, 'Please provide a job location.'],
    },
    type: {
        type: String,
        required: [true, 'Please provide a job type (e.g., Full-time).'],
    },
    salary: {
        type: String,
        required: [true, 'Please provide a salary range.'],
    },
    company: {
        type: String,
        default: 'Momentum AI',
    },
    skillsRequired: [{
        type: String,
        default: [],
    }],
    experience: {
        type: String,
        default: '',
    },
    qualification: {
        type: String,
        default: '',
    },
    employeeQualities: {
        type: String,
        default: '',
    },
    roleDocument: {
        name: { type: String, default: '' },
        type: { type: String, default: 'application/pdf' },
        size: { type: Number, default: 0 },
        data: { type: String, default: '' },
    },
    recruiterUid: {
        type: String,
        required: true,
    },
    recruiterEmail: {
        type: String,
        required: true
    },
    postedAt: {
        type: Date,
        default: Date.now,
    },
    interviewConfig: {
        type: {
            type: String,
            enum: ['video', 'ai-manual', 'ai-auto'],
            required: false
        },
        duration: Number,
        scheduleConfig: {
            startDate: Date,
            endDate: Date,
            startTime: String,
            endTime: String
        },
        deadline: Date,
        slots: [{
            date: String,
            time: String,
            isBooked: { type: Boolean, default: false },
            candidateId: String,
            applicationId: String
        }],
        questions: [String],
        aiTopic: String,
        aiDifficulty: {
            type: String,
            enum: ['Easy', 'Medium', 'Hard']
        }
    },
    counter: {
        type: Number,
        default: 0
    },
    applicants: [{
        uid: String,
        name: String
    }]
});

export default mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
