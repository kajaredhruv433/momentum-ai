const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/momentum';

// Define Schemas manually to avoid TS import issues
const UserSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const ResumeSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    skills: { type: String, default: "" },
    experience: [{
        role: String,
        company: String,
        details: String
    }],
    projects: [{
        name: String,
        description: String
    }]
});
const Resume = mongoose.models.Resume || mongoose.model('Resume', ResumeSchema);

const JobSchema = new mongoose.Schema({
    title: String,
    description: String,
    recruiterUid: String,
    status: String
});
const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

async function setup() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    const testUid = "ai_test_user_" + Date.now();

    // 1. Create User
    const user = await User.create({
        firebaseUid: testUid,
        email: `ai_test_${Date.now()}@example.com`,
        name: "AI Test Candidate",
        role: 'user'
    });
    console.log("Created User:", user.firebaseUid);

    // 2. Create Resume
    await Resume.create({
        userId: testUid,
        skills: "React, Node.js, Python, TensorFlow, MongoDB",
        experience: [
            { role: "Frontend Dev", company: "Tech Corp", details: "Built React apps." },
            { role: "AI Researcher", company: "AI Lab", details: "Used TensorFlow for NLP." }
        ],
        projects: [
            { name: "Portfolio", description: "Personal website in Next.js" }
        ]
    });
    console.log("Created Resume for:", testUid);

    // 3. Find a Job
    const job = await Job.findOne();
    if (!job) {
        console.error("No jobs found! Create a job first.");
        process.exit(1);
    }
    console.log("Using Job ID:", job._id.toString());

    // Output for next script
    console.log(`\nPARAMS: JOB_ID=${job._id} APPLICANT_UID=${testUid}`);

    process.exit(0);
}

setup().catch(err => {
    console.error(err);
    process.exit(1);
});
