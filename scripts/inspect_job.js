const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({ counter: Number, applicants: [mongoose.Schema.Types.Mixed] }, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const jobId = "6988dac71ba545f294ef0051";
        const job = await Job.findById(jobId);

        if (job) {
            console.log(`Job Found: ${job._id}`);
            console.log(`Title: ${job.title}`);
            console.log(`Counter: ${job.counter}`);
            console.log(`Applicants: ${JSON.stringify(job.applicants)}`);
            console.log(`Raw Document: ${JSON.stringify(job, null, 2)}`);
        } else {
            console.log(`Job with ID ${jobId} not found.`);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
