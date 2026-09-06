const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({ counter: Number, applicants: [mongoose.Schema.Types.Mixed] }, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const jobs = await Job.find({});
        console.log(`Checking ${jobs.length} jobs...`);

        jobs.forEach(job => {
            console.log(`Job: ${job.title} | ID: ${job._id}`);
            console.log(`  - Counter: ${job.counter}`);
            console.log(`  - Applicants: ${Array.isArray(job.applicants) ? job.applicants.length : 'Not an array'}`);
            if (Array.isArray(job.applicants) && job.applicants.length > 0) {
                console.log(`    First Applicant: ${JSON.stringify(job.applicants[0])}`);
                if (typeof job.applicants[0] === 'string') {
                    console.error('    ERROR: Applicant is still a string! Migration failed or logic is wrong.');
                } else if (job.applicants[0].uid && job.applicants[0].name) {
                    console.log('    SUCCESS: Applicant is an object with uid and name.');
                } else {
                    console.warn('    WARNING: Applicant object structure might be incorrect.');
                }
            }
        });

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
