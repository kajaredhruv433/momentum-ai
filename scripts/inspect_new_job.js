const mongoose = require('mongoose');

// Standard connection
mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Use strict: false to see what's actually in DB
        const JobSchema = new mongoose.Schema({ counter: Number, applicants: [mongoose.Schema.Types.Mixed] }, { strict: false });
        // Force new model compilation
        if (mongoose.models.Job) delete mongoose.models.Job;
        const Job = mongoose.model('Job', JobSchema);

        // This is the ID found in list_all_jobs.js
        const jobId = "6988dd87e70be5fa1ad2924c";

        const job = await Job.findById(jobId);

        if (job) {
            console.log(`Job Found: ${job._id}`);
            console.log(`Title: ${job.title}`);
            console.log(`Counter: ${job.counter}`); // Expecting undefined if issue persisted
            console.log(`Applicants: ${JSON.stringify(job.applicants)}`);
            // Check for old field
            console.log(`Recruiter UID: ${job.recruiterUid}`);
        } else {
            console.log(`Job with ID ${jobId} not found.`);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
