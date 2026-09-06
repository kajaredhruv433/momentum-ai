import os

V9_FRONTEND = r"C:\Users\dhruv\Music\Skill\EchoSphere\v9\frontend"

# 1. Update api.js
api_path = os.path.join(V9_FRONTEND, "src", "services", "api.js")
with open(api_path, "r", encoding="utf-8") as f:
    api_content = f.read()

target_create_fn = """  // Create and initialize interview
  createInterview: (companyDetails, resumeText, baseTime = 1800, extendedTime = 2700) =>
    request('/interviews', {
      method: 'POST',
      body: JSON.stringify({
        company_details: companyDetails,
        resume_text: resumeText,
        base_time: baseTime,
        extended_time: extendedTime,
      }),
    }),"""

new_create_fn = """  // Create and initialize interview with MongoDB metadata
  createInterview: (companyDetails, resumeText, baseTime = 1800, extendedTime = 2700, metadata = {}) =>
    request('/interviews', {
      method: 'POST',
      body: JSON.stringify({
        company_details: companyDetails,
        resume_text: resumeText,
        base_time: baseTime,
        extended_time: extendedTime,
        job_id: metadata?.jobId || null,
        candidate_id: metadata?.candidateId || null,
        candidate_email: metadata?.candidateEmail || null,
        application_id: metadata?.applicationId || null,
      }),
    }),

  // Fetch job requirements and candidate resume from MongoDB
  getSessionData: (jobId, candidateEmail, candidateId, applicationId) => {
    const params = new URLSearchParams();
    if (jobId) params.set('jobId', jobId);
    if (candidateEmail) params.set('candidateEmail', candidateEmail);
    if (candidateId) params.set('candidateId', candidateId);
    if (applicationId) params.set('applicationId', applicationId);
    return request(`/interview/session-data?${params.toString()}`);
  },"""

if target_create_fn in api_content:
    api_content = api_content.replace(target_create_fn, new_create_fn)
    with open(api_path, "w", encoding="utf-8") as f:
        f.write(api_content)
    print("Updated v9 api.js successfully")
else:
    print("target_create_fn not found in api.js (might already be updated)")

# 2. Update App.jsx
app_path = os.path.join(V9_FRONTEND, "src", "App.jsx")
with open(app_path, "r", encoding="utf-8") as f:
    app_content = f.read()

# Add metadataRef and session loading in App.jsx
# Locate const handleSubmitAnswerRef = useRef(null);
ref_target = "  const handleSubmitAnswerRef = useRef(null);"
ref_new = """  const handleSubmitAnswerRef = useRef(null);
  const metadataRef = useRef({});
  const [sessionFromMongo, setSessionFromMongo] = useState(null);"""

if ref_target in app_content and "metadataRef" not in app_content:
    app_content = app_content.replace(ref_target, ref_new)

# Add useEffect for session loading right after handleSubmitAnswerRef
effect_hook = """  // Automatically load Job requirements and Candidate Resume from MongoDB if parameters exist in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId') || params.get('job_id');
    const candidateEmail = params.get('candidateEmail') || params.get('email');
    const candidateId = params.get('candidateId') || params.get('uid');
    const applicationId = params.get('applicationId') || params.get('appId') || params.get('application_id');

    if (jobId || applicationId || candidateEmail || candidateId) {
      metadataRef.current = { jobId, candidateEmail, candidateId, applicationId };
      api.getSessionData(jobId, candidateEmail, candidateId, applicationId)
        .then((data) => {
          if (data?.company_details) {
            setJobData(data.company_details);
          }
          if (data?.resume_text) {
            setResumeText(data.resume_text);
          }
          setSessionFromMongo(data);
        })
        .catch((err) => {
          console.warn('Failed to load session data from MongoDB:', err);
        });
    }
  }, []);
"""

if "getSessionData" not in app_content:
    app_content = app_content.replace(ref_new, ref_new + "\n\n" + effect_hook)

# Update handleStartInterview to pass metadata
start_target = "      const response = await api.createInterview(jobData, resumeText);"
start_new = "      const response = await api.createInterview(jobData, resumeText, 1800, 2700, metadataRef.current);"

if start_target in app_content:
    app_content = app_content.replace(start_target, start_new)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(app_content)
print("Updated v9 App.jsx successfully")
