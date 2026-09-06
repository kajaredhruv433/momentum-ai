const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({}, { strict: false });
        // Clean model cache just in case
        if (mongoose.models.Job) delete mongoose.models.Job;
        const Job = mongoose.model('Job', JobSchema);

        const jobs = await Job.find({});
        console.log(`Found ${jobs.length} jobs.`);

        jobs.forEach(job => {
            console.log(`Job: ${job.title} | ID: ${job._id} (Type: ${typeof job._id})`);
            console.log(`  _id.toString(): ${job._id.toString()}`);
        });

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
