const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({ applicants: [String] }, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const ApplicationSchema = new mongoose.Schema({ jobId: mongoose.Schema.Types.ObjectId, applicantUid: String }, { strict: false });
        const Application = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);

        const jobs = await Job.find({});
        console.log(`Checking ${jobs.length} jobs...`);

        for (const job of jobs) {
            // Find all applications for this job
            const applications = await Application.find({ jobId: job._id });
            const applicantUids = applications.map(app => app.applicantUid);

            if (applicantUids.length > 0) {
                // Update the job with the list of applicant UIDs
                // We use $addToSet to avoid duplicates if migration is run multiple times
                await Job.findByIdAndUpdate(job._id, {
                    $addToSet: { applicants: { $each: applicantUids } }
                });
                console.log(`Job ${job.title}: Added ${applicantUids.length} applicant UIDs.`);
            }
        }

        console.log('Migration complete.');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
