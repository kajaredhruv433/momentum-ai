const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({}, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        // Find jobs without applicantsCount
        const jobs = await Job.find({ applicantsCount: { $exists: false } });
        console.log(`Found ${jobs.length} jobs to update.`);

        for (const job of jobs) {
            await Job.findByIdAndUpdate(job._id, { $set: { applicantsCount: 0 } });
            console.log(`Updated job ${job._id} with applicantsCount: 0`);
        }

        // Log all jobs status
        const allJobs = await Job.find({});
        allJobs.forEach(j => console.log(`Job ${j._id} count: ${j.applicantsCount}`));

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
