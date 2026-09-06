const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({}, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const ApplicationSchema = new mongoose.Schema({ jobId: mongoose.Schema.Types.ObjectId, recruiterUid: String }, { strict: false });
        const Application = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);

        const jobs = await Job.find({});
        console.log(`Checking ${jobs.length} jobs...`);

        for (const job of jobs) {
            const appCount = await Application.countDocuments({ jobId: job._id });
            console.log(`Job ${job.title} (${job._id})`);
            console.log(`  - Stored Count: ${job.applicantsCount}`);
            console.log(`  - Actual Applications: ${appCount}`);

            if (appCount !== (job.applicantsCount || 0)) {
                console.log(`  ! MISMATCH DETECTED ! Updating stored count...`);
                await Job.findByIdAndUpdate(job._id, { $set: { applicantsCount: appCount } });
                console.log(`  Fixed.`);
            }
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
