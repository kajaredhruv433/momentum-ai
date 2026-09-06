const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({
            title: String,
            counter: { type: Number, default: 0 },
            applicants: [{ uid: String, name: String }]
        }, { strict: false });

        if (mongoose.models.Job) delete mongoose.models.Job;
        const Job = mongoose.model('Job', JobSchema);

        const jobId = "6988dd87e70be5fa1ad2924c";

        console.log(`Checking job ${jobId}...`);
        const jobBefore = await Job.findById(jobId);
        if (!jobBefore) {
            console.error(`ERROR: Job ${jobId} NOT FOUND.`);
            process.exit(1);
        }
        console.log(`Job found. Current counter: ${jobBefore.counter}, Applicants: ${jobBefore.applicants.length}`);

        console.log(`Attempting update...`);
        try {
            const updatedJob = await Job.findByIdAndUpdate(
                jobId,
                {
                    $inc: { counter: 1 },
                    $push: { applicants: { uid: "TEST_USER_456", name: "Debug User" } }
                },
                { new: true, runValidators: false }
            );

            if (updatedJob) {
                console.log(`SUCCESS!`);
                console.log(`New Counter: ${updatedJob.counter}`);
                console.log(`New Applicants Count: ${updatedJob.applicants.length}`);
            } else {
                console.error(`ERROR: Update returned null!`);
            }
        } catch (e) {
            console.error(`EXCEPTION during update:`, e);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
