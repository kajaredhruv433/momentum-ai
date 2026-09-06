const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Define Schema EXACTLY as in Job.ts
        const JobSchema = new mongoose.Schema({
            title: String,
            counter: { type: Number, default: 0 },
            applicants: [{ uid: String, name: String }]
        }, { strict: false }); // Using strict false here to match potential runtime behavior if schema drifts, but mainly to see all fields

        // We need to overwrite the model to ensure we use this definition in this independent script
        if (mongoose.models.Job) delete mongoose.models.Job;
        const Job = mongoose.model('Job', JobSchema);

        const jobId = "6988dac71ba545f294ef0051"; // The job user created
        const applicantUid = "TEST_USER_123";
        const applicantName = "Test Candidate";

        console.log(`Applying to job ${jobId}...`);

        const updatedJob = await Job.findByIdAndUpdate(
            jobId,
            {
                $inc: { counter: 1 },
                $push: { applicants: { uid: applicantUid, name: applicantName } }
            },
            { new: true }
        );

        if (updatedJob) {
            console.log(`Success!`);
            console.log(`Counter: ${updatedJob.counter}`);
            console.log(`First Applicant: ${JSON.stringify(updatedJob.applicants[0])}`);
            console.log(`Full Doc: ${JSON.stringify(updatedJob, null, 2)}`);
        } else {
            console.log(`Job not found or update failed.`);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
