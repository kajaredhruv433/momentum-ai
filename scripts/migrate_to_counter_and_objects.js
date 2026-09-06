const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({ applicantsCount: Number, counter: Number, applicants: [mongoose.Schema.Types.Mixed] }, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const UserSchema = new mongoose.Schema({ firebaseUid: String, name: String }, { strict: false });
        const User = mongoose.models.User || mongoose.model('User', UserSchema);

        const jobs = await Job.find({});
        console.log(`Checking ${jobs.length} jobs...`);

        for (const job of jobs) {
            let updates = {};

            // Migrate applicantsCount -> counter
            if (job.applicantsCount !== undefined && job.counter === undefined) {
                updates.counter = job.applicantsCount;
                updates.applicantsCount = 0; // Optional: keep or remove
                console.log(`Job ${job._id}: migrating applicantsCount (${job.applicantsCount}) to counter.`);
            } else if (job.counter === undefined) {
                updates.counter = 0;
            }

            // Migrate applicants [String] -> [{uid, name}]
            if (Array.isArray(job.applicants) && job.applicants.length > 0 && typeof job.applicants[0] === 'string') {
                console.log(`Job ${job._id}: converting applicants array...`);
                const newApplicants = [];
                for (const uid of job.applicants) {
                    const user = await User.findOne({ firebaseUid: uid });
                    newApplicants.push({
                        uid: uid,
                        name: user ? user.name : 'Unknown Candidate'
                    });
                }
                updates.applicants = newApplicants;
            }

            if (Object.keys(updates).length > 0) {
                // Use $set for updates and $unset to remove old field if desired
                await Job.findByIdAndUpdate(job._id, { $set: updates, $unset: { applicantsCount: "" } });
                console.log(`Job ${job._id} updated.`);
            }
        }

        console.log('Migration complete.');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
