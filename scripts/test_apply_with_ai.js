const http = require('http');

// Configuration
const APPLICANT_UID = "ai_test_user_1770578842952";
const JOB_ID = "6988e0f0e70be5fa1ad2927c";

const postData = JSON.stringify({
    jobId: JOB_ID,
    applicantUid: APPLICANT_UID, // New user to avoid "already applied"
    coverNote: "This is a test application for AI review."
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/applications/apply',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log(`Applying as ${APPLICANT_UID} to job ${JOB_ID}...`);

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log(`BODY: ${data}`);
        try {
            const json = JSON.parse(data);
            if (json.aiReview) {
                console.log("✅ AI Review present:", json.aiReview);
            } else {
                console.log("❌ AI Review MISSING");
            }
            if (json.score !== undefined) {
                console.log("✅ Score present:", json.score);
            } else {
                console.log("❌ Score MISSING");
            }
        } catch (e) {
            console.log("Error parsing response:", e);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
