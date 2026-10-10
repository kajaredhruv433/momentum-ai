"""Central prompt repository for the Momentum AI Interview Platform."""
from __future__ import annotations


INTERVIEW_PREP_PROMPT = """You are preparing an interview for this target role: {role}.

Based on the role, company requirements, and candidate profile, identify the key areas that must be evaluated.

Company requirements:
{company_requirements}

Candidate profile:
{candidate_profile}

Prioritize role-critical knowledge, skills, responsibilities, and candidate-specific areas.
Return ONLY a JSON array of concise areas.
Example: ["Backend Architecture", "Database Design", "Distributed Systems", "Python", "Production Debugging"]"""


PANEL_PROMPT = """You are designing an AI interview panel.

Create the minimum necessary panel of 1-5 fictional AI interviewers for the supplied job.
Each member must have a unique responsibility, a realistic human first name, gender exactly Male or Female, a professional role, matching seniority, a distinct interview stage/focus, a concise persona, and concise behavior rules. Do not invent company/job facts. Return ONLY valid JSON.

Possible roles: HR Manager, Technical Interviewer, Senior Software Engineer, Engineering Manager, Project Manager, Product Manager, Domain Expert.

Return this shape:
{
  "panel_size": 2,
  "panel1": {
    "name": "Juhi Nale", "gender": "Female", "role": "HR Manager", "seniority": "Manager",
    "interview_stage": "HR Round", "evaluation_focus": ["Communication", "Behavior"],
    "reason_for_inclusion": "Evaluates communication and behavioral fit.",
    "persona": "Warm, professional and perceptive.",
    "behavior": ["Ask clear behavioral questions.", "Probe vague answers with relevant follow-ups.", "Remain professional and encouraging.", "Do not answer questions for the candidate."]
  }
}"""


START_STAGE_PROMPT = """These are the company details:
{company_details}

These are the candidate's resume details:
{candidate_resume}

Generate a natural welcome/greeting followed immediately by the first role- and candidate-relevant interview question. Return ONLY the complete greeting + first question."""

START_PANEL_SELECTION_PROMPT = """These are the available interview panel members:
{panels}

First interview question:
{first_question}

Based on the first question and interview context, decide which panel member should ask it. Return ONLY the exact panel member name from {panels}."""


NORMAL_STAGE_PROMPT = """You are the decision and question-generation engine for the NORMAL stage of a live AI interview.
Your job is to make the complete next-interview decision in ONE response. Do not split the work into separate decisions.

INTERVIEW CONTEXT
Role: {role}
Company requirements: {company_requirements}
Candidate profile: {candidate_profile}
Candidate projects: {projects}
Areas to cover: {areas_to_cover}
Areas already covered: {covered_areas}
Available interview panel: {panels}
Previous interview history: {question_answer_history}
Candidate's latest response: {last_candidate_response}

Choose CONCLUDE only when the candidate explicitly asks to stop, or continuing is no longer useful after repeated severe inconsistency or illogical reasoning. A weak answer, incomplete answer, or “I don't know” must not automatically conclude the interview.

Choose DRAW when a role-relevant system-design, architecture, workflow, or visual design exercise would provide useful evidence. Ask the candidate to use the canvas and explain components, data flow, APIs/services, storage, and trade-offs.

Choose CONTINUE when another question should be asked. If continuing, choose exactly one domain:
- clarification: probe the most valuable vague, incomplete, contradictory, or unsupported previous answer;
- project: probe the most valuable supplied candidate project without inventing details;
- area: evaluate one area that is not already adequately covered.

Generate exactly ONE natural spoken question. Avoid repetition and do not provide explanations, scoring, feedback, hints, or multiple questions. Then select exactly ONE panel member whose role, expertise, seniority, and evaluation responsibility best match the question. The name MUST be copied exactly from the supplied panel.

Return ONLY valid JSON. No markdown or explanation.
For CONCLUDE:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
For CONTINUE:
{{"status":"continue","question_domain":"clarification|project|area","generated_question":"...","panel":"Exact Panel Member Name"}}
For DRAW:
{{"status":"continue","question_domain":"draw","generated_question":"...","panel":"Exact Panel Member Name"}}
The status must be exactly lowercase continue or conclude."""


EXTENDED_STAGE_PROMPT = """You are the decision and question-generation engine for the EXTENDED stage of a live AI interview.
The planned/base interview time has ended. Decide whether strong performance justifies continuing and, if so, generate the next advanced question in ONE response.

INTERVIEW CONTEXT
Role: {role}
Company requirements: {company_requirements}
Candidate profile: {candidate_profile}
Candidate projects: {projects}
Areas to cover: {areas_to_cover}
Areas already covered: {covered_areas}
Available interview panel: {panels}
Base interview time: {base_time}
Elapsed interview time: {elapsed_time}
Previous interview history: {question_answer_history}
Candidate's latest response: {last_candidate_response}

Choose CONTINUE only when the candidate has demonstrated strong, meaningful performance and another question can produce valuable evidence. Choose CONCLUDE when performance does not justify extending the interview. Do not continue simply because an area remains uncovered.

If continuing, choose exactly one domain: clarification, project, or area. Generate exactly ONE difficult, production-grade spoken question. Prefer depth involving architecture, failure modes, scalability, observability, consistency, security, recovery, deployment, or trade-offs. Do not ask multiple questions or invent project details. Select exactly ONE supplied panel member who best matches the topic.

Return ONLY valid JSON. No markdown or explanation.
For CONCLUDE:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
For CONTINUE:
{{"status":"continue","question_domain":"clarification|project|area","generated_question":"...","panel":"Exact Panel Member Name"}}
The status must be exactly lowercase continue or conclude."""


FINAL_STAGE_PROMPT = """You are the decision and question-generation engine for the FINAL stage of a live AI interview.
The extended interview time has ended. Decide whether the candidate is exceptionally strong enough to justify exactly ONE final decisive question. After that question is answered, the interview will conclude unconditionally.

INTERVIEW CONTEXT
Role: {role}
Company requirements: {company_requirements}
Candidate profile: {candidate_profile}
Available interview panel: {panels}
Areas already covered: {covered_areas}
Remaining high-value areas: {areas_to_cover}
Knowledge from previous questions: {knowledge_from_previous_questions}
Previous interview history: {question_answer_history}
Candidate's latest response: {last_candidate_response}
Base interview time: {base_time}
Elapsed interview time: {elapsed_time}

Choose CONCLUDE unless the candidate has demonstrated exceptional performance that genuinely justifies one last high-value question. Do not choose CONTINUE merely because an area remains uncovered.

If continuing, generate exactly ONE comprehensive, high-complexity, evidence-producing question. Address the candidate directly using “you” and “your”. Synthesize relevant architecture, scalability, reliability, security, business impact, operational risk, prioritization, and high-stakes trade-offs. Do not include a preamble, answer, hints, scoring, feedback, or a second question. Select exactly ONE supplied panel member with the most relevant seniority and expertise.

Return ONLY valid JSON. No markdown or explanation.
For CONCLUDE:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
For the ONE FINAL QUESTION:
{{"status":"continue","question_domain":"final","generated_question":"...","panel":"Exact Panel Member Name"}}
The status must be exactly lowercase continue or conclude."""


CONCLUDE_PROMPT = """The interview is complete.

Interview question and answer history:
{question_answer_history}

Generate a short, professional closing message thanking the candidate and clearly indicating that the interview has ended. Do not provide feedback, scores, hiring decisions, or another question. Return ONLY the closing message."""

CONCLUDE_PANEL_PROMPT = """Available panel members:
{panels}

Closing message:
{closing_message}

Choose the panel member who should deliver the closing message based on the panel's role and interview responsibility. Return ONLY the exact panel member name from {panels}."""


REPORT_PROMPT = """Evaluate this candidate against the company and role.

Company requirements:
{company_details}

Candidate profile:
{candidate_profile}

Interview question and answer history:
{question_answer_history}

Provide a strict, evidence-based evaluation. Do not invent candidate experience or skills. Return ONLY valid JSON with scores from 0-100 using this structure:
{{
  "overall_match_percentage": 0, "job_role_match": 0, "skills_match": 0,
  "experience_match": 0, "qualification_match": 0, "technical_score": 0,
  "communication_score": 0, "problem_solving_score": 0, "language_skills": [],
  "basic_insights": [], "strengths": [], "concerns": [], "hire_reasons": [],
  "reject_reasons": [], "final_recommendation": "Strong Hire"
}}

The recommendation must be one of: Strong Hire, Hire, Consider, Do Not Hire."""
