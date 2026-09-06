const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Use strict: false to see what's actually in DB
        const JobSchema = new mongoose.Schema({ interviewConfig: mongoose.Schema.Types.Mixed }, { strict: false });
        if (mongoose.models.Job) delete mongoose.models.Job;
        const Job = mongoose.model('Job', JobSchema);

        const jobId = "6988dd87e70be5fa1ad2924c";

        const job = await Job.findById(jobId);

        if (job) {
            console.log(`Job Found: ${job._id}`);
            console.log(`Interview Config: ${JSON.stringify(job.interviewConfig)}`);
            console.log(`Type of config: ${typeof job.interviewConfig}`);
        } else {
            console.log(`Job with ID ${jobId} not found.`);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
