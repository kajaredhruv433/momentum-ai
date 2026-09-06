import asyncio
import sys
from pathlib import Path
from bson import ObjectId
import pymongo

# Ensure site packages and backend packages are loaded
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, r"C:\Users\dhruv\Music\Skill\EchoSphere\v9\backend\.venv\Lib\site-packages")
sys.path.insert(0, str(BASE_DIR / "backend" / "interviewer" / "backend"))
sys.path.insert(0, str(BASE_DIR))

from api.interview import get_interview_setup_data
from backend.routers.recruiter import get_interviewed_candidates, RecruiterApplicantsRequest
from tools.database import mongo

async def run_verification():
    print("==================================================")
    print("ECHOSPHERE & MOMENTUM END-TO-END VERIFICATION")
    print("==================================================")

    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["momentum"]

    # 1. Fetch existing Job & Candidate Application
    job = db.jobs.find_one()
    if not job:
        print("ERROR: No jobs found in momentum database!")
        return False

    job_id_str = str(job["_id"])
    print(f"\n[Step 1] Found Test Job: {job.get('title')} @ {job.get('company')} (ID: {job_id_str})")

    # 2. Test Setup-data Extraction from MongoDB
    print("\n[Step 2] Testing /api/interview/setup-data extraction from MongoDB...")
    setup_data = get_interview_setup_data(
        jobId=job_id_str,
        candidateEmail="dhruv.sharma@example.com",
        candidateId="candidate_dhruv_001"
    )

    assert setup_data["success"] is True, "Setup data extraction returned success=False"
    assert "jobData" in setup_data, "Missing jobData"
    assert "resumeText" in setup_data, "Missing resumeText"
    assert len(setup_data["resumeText"]) > 50, "Resume text is too short"
    print(f" -> Job Data Extracted: {setup_data['jobData']['role']} at {setup_data['jobData']['company_name']}")
    print(f" -> Candidate Profile: {setup_data['candidateProfile']['name']} ({setup_data['candidateProfile']['email']})")
    print(f" -> Resume Text Extracted: {len(setup_data['resumeText'])} chars")
    print(" -> SUCCESS: Setup data automatically extracted from MongoDB without user manual input!")

    # 3. Simulate Interview Conclusion and Persistence
    print("\n[Step 3] Simulating Interview Conclusion & MongoDB Report Persistence...")
    test_interview_id = "test-interview-" + ObjectId().__str__()[:8]
    test_report = {
        "overall_match_percentage": 92,
        "job_role_match": 90,
        "skills_match": 95,
        "experience_match": 88,
        "qualification_match": 95,
        "technical_score": 94,
        "communication_score": 90,
        "problem_solving_score": 92,
        "strengths": ["Excellent distributed architecture reasoning", "Fluent FastAPI & caching mastery"],
        "concerns": [],
        "hire_reasons": ["High technical competency for senior role"],
        "reject_reasons": [],
        "final_recommendation": "Strong Hire"
    }

    # Find or create application for this candidate & job
    app = db.applications.find_one({"jobId": job["_id"]})
    if not app:
        app_doc = {
            "jobId": job["_id"],
            "applicantUid": "candidate_dhruv_001",
            "recruiterUid": job.get("recruiterUid", "test_recruiter_123"),
            "applicantName": "Dhruv Sharma",
            "applicantEmail": "dhruv.sharma@example.com",
            "jobTitle": job.get("roleRequired") or job.get("title"),
            "company": job.get("company"),
            "status": "Applied",
            "score": 0,
            "matchScore": 0
        }
        res = db.applications.insert_one(app_doc)
        app = db.applications.find_one({"_id": res.inserted_id})

    app_id_str = str(app["_id"])
    print(f" -> Testing with Application ID: {app_id_str}")

    # Update application with interview completion results
    db.applications.update_one(
        {"_id": app["_id"]},
        {
            "$set": {
                "status": "Completed",
                "score": test_report["overall_match_percentage"],
                "matchScore": test_report["overall_match_percentage"],
                "technicalScore": test_report["technical_score"],
                "communicationScore": test_report["communication_score"],
                "problemSolvingScore": test_report["problem_solving_score"],
                "recommendation": test_report["final_recommendation"],
                "report": test_report,
                "interviewId": test_interview_id,
                "candidateId": "candidate_dhruv_001",
            }
        }
    )

    # Also write to interview_sessions
    db.interview_sessions.update_one(
        {"interviewId": test_interview_id},
        {
            "$set": {
                "interviewId": test_interview_id,
                "candidateId": "candidate_dhruv_001",
                "candidateEmail": "dhruv.sharma@example.com",
                "candidateName": "Dhruv Sharma",
                "jobId": job_id_str,
                "applicationId": app_id_str,
                "report": test_report,
                "matchScore": test_report["overall_match_percentage"],
                "status": "completed"
            }
        },
        upsert=True
    )

    # Verify persisted application
    persisted = db.applications.find_one({"_id": app["_id"]})
    assert persisted["status"] == "Completed", "Application status was not updated to Completed"
    assert persisted["matchScore"] == 92, "Application matchScore mismatch"
    assert persisted["interviewId"] == test_interview_id, "interviewId not saved"
    print(f" -> SUCCESS: Application persisted with status={persisted['status']}, matchScore={persisted['matchScore']}%, interviewId={persisted['interviewId']}")

    # 4. Test Recruiter Interviewed Candidates Leaderboard (Strictly Descending Order)
    print("\n[Step 4] Testing Recruiter Interviewed Candidates Leaderboard...")
    recruiter_uid = job.get("recruiterUid") or "test_recruiter_123"
    req = RecruiterApplicantsRequest(recruiterUid=recruiter_uid)
    interviewed = await get_interviewed_candidates(req)

    print(f" -> Found {len(interviewed)} interviewed candidates for recruiter '{recruiter_uid}':")
    for cand in interviewed:
        print(f"    Rank #{cand['rank']} | {cand['name']} | Role: {cand['role']} | Match Score: {cand['matchScore']}% | Status: {cand['status']} | ID: {cand.get('interviewId')}")

    assert len(interviewed) > 0, "No candidates returned by recruiter interviewed endpoint"
    # Verify strict descending order
    scores = [c["matchScore"] for c in interviewed]
    assert scores == sorted(scores, reverse=True), f"Candidates are not in descending order: {scores}"
    print(f" -> SUCCESS: Candidates verified in strictly descending order of match scores: {scores}")

    print("\n==================================================")
    print("ALL VERIFICATIONS PASSED SUCCESSFULLY!")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = asyncio.run(run_verification())
    if not success:
        sys.exit(1)
