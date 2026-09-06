const http = require('http');

const jobId = "6988dd87e70be5fa1ad2924c";
const postData = JSON.stringify({
    interviewConfig: {
        type: 'video',
        duration: 45,
        scheduleConfig: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
            startTime: "09:00",
            endTime: "17:00"
        }
    }
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/jobs/${jobId}/interview`,
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();
