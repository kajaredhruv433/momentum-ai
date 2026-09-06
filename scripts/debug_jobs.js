const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Define schema with strict: false to see all fields
        const JobSchema = new mongoose.Schema({}, { strict: false });

        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const jobs = await Job.find({});
        console.log('Jobs found:', jobs.length);

        jobs.forEach(job => {
            console.log(JSON.stringify(job, null, 2));
        });

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
