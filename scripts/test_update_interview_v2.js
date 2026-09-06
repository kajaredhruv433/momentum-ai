const http = require('http');

const jobId = "6988dd87e70be5fa1ad2924c";

function makeRequest(path, method, body) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
        console.log(`[${method} ${path}] STATUS: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`BODY: ${data.substring(0, 200)}...`); // Truncate
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    if (body) req.write(body);
    req.end();
}

// 1. Check known working route
makeRequest('/api/jobs', 'GET');

// 2. Check the interview route
const postData = JSON.stringify({
    interviewConfig: { type: 'video', duration: 30 }
});
makeRequest(`/api/jobs/${jobId}/interview`, 'PUT', postData);
