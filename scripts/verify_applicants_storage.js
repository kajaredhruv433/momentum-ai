const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({}, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const jobs = await Job.find({ applicants: { $exists: true, $not: { $size: 0 } } });
        console.log(`Found ${jobs.length} jobs with applicants stored.`);

        jobs.forEach(job => {
            console.log(`Job: ${job.title} | Applicants UIDs: ${JSON.stringify(job.applicants)}`);
        });

        if (jobs.length === 0) {
            console.log('No jobs found with applicants array populated yet. Apply to a job to test!');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
