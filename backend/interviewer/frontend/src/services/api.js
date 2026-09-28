/**
 * api.js
 *
 * HTTP client communicating with FastAPI backend endpoints.
 */

const API_BASE = '/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || `HTTP Error ${response.status}`;
    throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
  }

  return data;
}

export const api = {
  // Fetch job details and candidate resume from MongoDB
  getSetupData: (jobId, candidateId, candidateEmail, applicationId) => {
    const params = new URLSearchParams();
    if (jobId) params.append('jobId', jobId);
    if (candidateId) params.append('candidateId', candidateId);
    if (candidateEmail) params.append('candidateEmail', candidateEmail);
    if (applicationId) params.append('applicationId', applicationId);
    return request(`/interview/setup-data?${params.toString()}`);
  },

  // Create and initialize interview
  createInterview: (
    companyDetails,
    resumeText,
    baseTime = 1800,
    extendedTime = 2700,
    candidateId = null,
    candidateEmail = null,
    candidateName = null,
    jobId = null,
    applicationId = null
  ) =>
    request('/interviews', {
      method: 'POST',
      body: JSON.stringify({
        company_details: companyDetails,
        resume_text: resumeText,
        base_time: baseTime,
        extended_time: extendedTime,
        candidate_id: candidateId,
        candidate_email: candidateEmail,
        candidate_name: candidateName,
        job_id: jobId,
        application_id: applicationId,
      }),
    }),

  // Get live status
  getInterviewStatus: (interviewId) => request(`/interviews/${interviewId}`),

  // Submit candidate answer (voice or text)
  submitAnswer: (interviewId, answer, inputMethod = 'text', questionId = null) =>
    request(`/interviews/${interviewId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        answer,
        input_method: inputMethod,
        question_id: questionId,
      }),
    }),

  // Get final evaluation report
  getReport: (interviewId) => request(`/interviews/${interviewId}/report`),

  // Conclude interview explicitly
  concludeInterview: (interviewId) =>
    request(`/interviews/${interviewId}/conclude`, {
      method: 'POST',
    }),

  questionStarted: (interviewId) => request(`/interviews/${interviewId}/question-started`, { method: 'POST' }),
  speechFinished: (interviewId) => request(`/interviews/${interviewId}/speech-finished`, { method: 'POST' }),

  // Parse candidate resume
  parseResume: (resumeText) =>
    request('/candidate/parse', {
      method: 'POST',
      body: JSON.stringify({ resume_text: resumeText }),
    }),

  // Submit system-design canvas drawing (base64 PNG → AI analysis)
  submitCanvas: (interviewId, questionId, imageDataUrl) =>
    request(`/interview/${interviewId}/canvas`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        image_data: imageDataUrl,
      }),
    }),
};
