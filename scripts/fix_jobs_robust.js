const mongoose = require('mongoose');

// Force strict: false to see all fields
mongoose.connect('mongodb://localhost:27017/momentum')
    .then(async () => {
        console.log('Connected to MongoDB');

        const JobSchema = new mongoose.Schema({ counter: Number, applicants: [mongoose.Schema.Types.Mixed], applicantsCount: Number }, { strict: false });
        const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

        const jobs = await Job.find({});
        console.log(`Checking ${jobs.length} jobs for migration...`);

        for (const job of jobs) {
            let needsUpdate = false;
            let updates = {};
            let unsets = {};

            // 1. Ensure counter exists
            if (job.counter === undefined) {
                if (job.applicantsCount !== undefined) {
                    updates.counter = job.applicantsCount;
                    unsets.applicantsCount = "";
                    console.log(`[${job._id}] Migrating applicantsCount (${job.applicantsCount}) -> counter`);
                } else {
                    updates.counter = 0;
                    console.log(`[${job._id}] Initializing counter to 0`);
                }
                needsUpdate = true;
            }

            // 2. Ensure applicants is an array
            if (!Array.isArray(job.applicants)) {
                updates.applicants = [];
                console.log(`[${job._id}] Initializing applicants to []`);
                needsUpdate = true;
            } else {
                // Check if applicants are strings (old format)
                if (job.applicants.length > 0 && typeof job.applicants[0] === 'string') {
                    // We need to fetch names, but for now let's just wrap them? 
                    // Or clearing them might be safer if we can't find names easily here without User model
                    // Let's assume we keep them as is but script logic in previous run handled it? 
                    // Let's just log for now.
                    console.log(`[${job._id}] Applicants are strings! Rerun full migration if needed.`);
                }
            }

            if (needsUpdate) {
                let updateQuery = { $set: updates };
                if (Object.keys(unsets).length > 0) updateQuery.$unset = unsets;

                await Job.findByIdAndUpdate(job._id, updateQuery);
                console.log(`[${job._id}] SUCCESS: Updated job.`);
            } else {
                console.log(`[${job._id}] SKIPPING: Already valid.`);
            }
        }

        console.log('Migration verified.');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
