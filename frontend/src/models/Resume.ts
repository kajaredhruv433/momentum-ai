import mongoose from 'mongoose';

const ResumeSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    uid: { type: String }, // Store User collection's unique UID for identification
    personal: {
        fullName: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        location: { type: String, default: "" },
        summary: { type: String, default: "" },
        role: { type: String, default: "" },
        targetCompany: { type: String, default: "" },
    },
    education: [{
        id: String,
        school: String,
        degree: String,
        year: String,
        percentage: String,
        type: { type: String }
    }],
    experience: [{
        id: String,
        company: String,
        role: String,
        duration: String,
        details: String
    }],
    skills: { type: String, default: "" },
    projects: [{
        id: String,
        name: String,
        tech: String,
        link: String,
        description: String
    }],
    achievements: [{
        id: String,
        title: String,
        date: String,
        description: String
    }],
    analysis: {
        score: { type: Number, default: 0 },
        status: { type: String, default: "" },
        feedback: { type: String, default: "" },
        strengths: [String],
        improvements: [String]
    },
    updatedAt: { type: Date, default: Date.now }
});

// Force recompilation in dev to pick up schema changes
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Resume;
}

export default mongoose.models.Resume || mongoose.model('Resume', ResumeSchema);
