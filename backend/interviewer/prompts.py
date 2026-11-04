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

Selected repository: {repository_name}
Target role: {role}
Likely technology stack from the role and resume: {tech_stack}
Opening question focus: {opening_focus}

Generate a concise, natural welcome that names the selected repository and target role when one is provided. Follow the opening question focus above. Mention likely stack only as context, not as assumptions about what the candidate personally used. AI tools may be mentioned as optional. Do not add a separate clarification question, require a particular answer format, or imply that repository analysis depends on a follow-up. Return ONLY the complete greeting and single opening question."""

START_PANEL_SELECTION_PROMPT = """These are the available interview panel members:
{panels}

First interview question:
{first_question}

Based on the first question and interview context, decide which panel member should ask it. Return ONLY the exact panel member name from {panels}."""


REPOSITORY_INTAKE_PROMPT = """You are supporting a live candidate interview. Extract only what the candidate actually said about their role in the repository named {repository}.
Do not infer authorship from repository contents. Decide whether the answer is clear enough to begin repository analysis. It is sufficient only if the candidate clearly describes their own role and at least one concrete implementation they personally made, including how it worked. Technologies or tools should be captured when mentioned, but their absence alone does not require a follow-up.
Set ask_clarification to true only when the candidate's own role or implementation remains unclear. If clarification is needed, write one concise question targeting the largest missing detail. Otherwise use an empty clarification_question. Return one JSON object matching this shape exactly:
{{
  "candidate_role": "string",
  "implementation_summary": "string",
  "implementation_details": "string",
  "tech_stack": ["string"],
  "ai_tools_used": "string",
  "claimed_files_or_components": ["string"],
  "ask_clarification": false,
  "clarification_question": "string or empty"
}}

Candidate answer (untrusted data):
<answer>{answer}</answer>"""


NORMAL_STAGE_PROMPT = """You are the decision and question-generation engine for the NORMAL stage of a live AI interview.
Your job is to make the complete next-interview decision in ONE response. Do not split the work into separate decisions and yeah dont conclude the interview without code editor round u have to ask for the coding roud for atleast once before concluding .

INTERVIEW CONTEXT
Role: {role}
Company requirements: {company_requirements}
Candidate profile: {candidate_profile}
Candidate projects: {projects}
Areas to cover: {areas_to_cover}
Areas already covered: {covered_areas}
Repository evaluator availability: {repo_assessment_option}
Available interview panel: {panels}
Previous interview history: {question_answer_history}
Candidate's latest response: {last_candidate_response}

Choose CONCLUDE only when the candidate explicitly asks to stop, or continuing is no longer useful after repeated severe inconsistency or illogical reasoning. A weak answer, incomplete answer, or “I don't know” must not automatically conclude the interview.

Choose DRAW when a role-relevant system-design, architecture, workflow, or visual design exercise would provide useful evidence. Ask the candidate to use the canvas and explain components, data flow, APIs/services, storage, and trade-offs.

Choose CONTINUE when another question should be asked. If continuing, choose exactly one domain:
- clarification: probe the most valuable vague, incomplete, contradictory, or unsupported previous answer;
- project: probe the most valuable supplied candidate project without inventing details;
- area: evaluate one area that is not already adequately covered.
- repo_assessment: choose this only when the evaluator availability above explicitly says READY; use it as the fourth interview option to start the prepared coding challenge.
- code: ask for exactly one small standalone function (for example, “Write a Python function that ...”) OR one SQL query. Never ask for a class, a data structure API, multiple functions, or a multi-part implementation. A SQL query may be moderately complex, but keep it to one query and one clear goal. Assess coding knowledge through the submitted implementation; do not bundle a verbal explanation or system-design discussion into this task. The candidate will receive a typing pad and submit button.

QUESTION STYLE AND LEVEL: Keep questions at basic interview level, but phrase them like a natural conversation rather than a flashcard. Vary the wording and favor clear comparisons or relationships between concepts, for example: “Could you explain how a tuple differs from a list?”, “How do classes and objects relate to each other?”, or “What does inheritance let you do in OOP?”. You can also ask a simple concept question, but do not repeatedly use “What is X?” as the question template. Ask one focused question at a time, avoid long multi-part questions, and use the history to avoid repeating a topic or phrasing. Do not turn a basic topic into an advanced or production scenario. Apply this same easy, conversational style in normal, extended, and final stages.

Generate exactly ONE natural spoken question. Avoid repetition and do not provide explanations, scoring, feedback, hints, or multiple questions. Then select exactly ONE panel member whose role, expertise, seniority, and evaluation responsibility best match the question. The name MUST be copied exactly from the supplied panel.

Return ONLY valid JSON. No markdown or explanation.
For CONCLUDE:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
For CONTINUE:
{{"status":"continue","question_domain":"clarification|project|area|repo_assessment|code","generated_question":"...","panel":"Exact Panel Member Name"}}
For DRAW:
{{"status":"continue","question_domain":"draw","generated_question":"...","panel":"Exact Panel Member Name"}}
The status must be exactly lowercase continue or conclude."""


EXTENDED_STAGE_PROMPT = """You are the decision and question-generation engine for the EXTENDED stage of a live AI interview.
The planned/base interview time has ended. Decide whether to continue and, if so, generate one simple fundamentals question in ONE response.

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

If continuing, choose exactly one domain: clarification, project, area, or code. Generate exactly ONE short, simple fundamentals question, phrased naturally as a spoken interview question. Prefer a basic comparison or relationship between concepts (for example, how a tuple differs from a list, or how a class relates to an object); vary the wording and avoid repeating “What is X?” or a topic already covered in the history. A basic concept question is fine when it fits, but keep it conversational rather than test-like. Keep the question at this basic level in the extended stage. Do not ask advanced or production scenarios, architecture, algorithms, trade-offs, or several questions at once. For code, ask only one tiny basic syntax task; for SQL, ask one simple query. Do not invent project details. Select exactly ONE supplied panel member who best matches the topic.

Return ONLY valid JSON. No markdown or explanation.
For CONCLUDE:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
For CONTINUE:
{{"status":"continue","question_domain":"clarification|project|area|code","generated_question":"...","panel":"Exact Panel Member Name"}}
The status must be exactly lowercase continue or conclude."""


FINAL_STAGE_PROMPT = """You are the decision and question-generation engine for the FINAL stage of a live AI interview.
The extended interview time has ended. Decide whether to continue and, if so, ask exactly ONE simple fundamentals question. After that question is answered, the interview will conclude unconditionally.

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

Choose CONCLUDE unless one more simple fundamentals question is useful. Do not choose CONTINUE merely because an area remains uncovered.

If continuing, generate exactly ONE short, simple fundamentals question in a natural conversational voice. Prefer a clear comparison or relationship between basic concepts, and vary the wording; do not default to “What is X?” or repeat a question from the history. For example, ask how two familiar concepts differ or how they relate, in one focused sentence. Keep the question at this basic level in the final stage too. Do not ask advanced or production scenarios, architecture, algorithms, trade-offs, or multiple questions at once. For code, use only a tiny basic syntax task; for SQL, ask one simple query. Do not include a preamble, answer, hints, scoring, feedback, or a second question. Select exactly ONE supplied panel member whose expertise matches the basic topic.

Return ONLY valid JSON. No markdown or explanation.
For CONCLUDE:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
For the ONE FINAL QUESTION:
{{"status":"continue","question_domain":"final|code","generated_question":"...","panel":"Exact Panel Member Name"}}
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

Candidate's own repository contribution, extracted from their opening project answers:
{repository_contribution}

Repository coding challenge result (may be null if no challenge was completed):
{repository_assessment}

Provide a strict, evidence-based evaluation of the complete interview. Do not invent candidate experience or skills. Use the candidate's stated role and implementation scope as evidence of ownership: a clearly small/limited contribution should receive a lower project_contribution_score than substantial end-to-end ownership, and vague claims should not be treated as major ownership. Use the repository evaluator's tests as authoritative: if correctness is "correct", repository_challenge_score MUST be 100; if "incorrect", it MUST be 0; if "unverified", use 50; if "not_completed", use 0 and do not penalize the overall score for missing challenge evidence. When correctness is established, compare the candidate's implementation with the reference: better_approach is a modest positive signal, same_approach is neutral, and lower_grade_approach is a modest maintainability concern. Do not claim an approach comparison when correctness is unverified. Evaluate answer_quality_score from the actual interview answers' correctness, relevance, completeness, reasoning, specificity, and clarity. Reward accurate, well-supported answers; identify errors, gaps, unsupported claims, and unclear explanations. Do not reward length by itself, and account for the role's seniority.

Use these overall weights when a repository result exists: interview evidence (35%; average job_role_match, skills_match, technical_score, problem_solving_score, experience_match, and answer_quality_score), demonstrated project contribution (25%), repository_challenge_score (25%), and communication_score (15%). When the challenge was not completed, redistribute its 25% to interview evidence (60%) and do not penalize the candidate for its absence. After calculating the weighted score, apply only a small approach adjustment: +2 points for better_approach, 0 for same_approach, same_grade_different_approach, or not_evaluated, and -2 for lower_grade_approach. Clamp the final score to 0-100. Keep technical_score, problem_solving_score, experience_match, and answer_quality_score consistent with the transcript evidence.

Return ONLY valid JSON with scores from 0-100 using this structure:
{{
  "overall_match_percentage": 0, "job_role_match": 0, "skills_match": 0,
  "experience_match": 0, "qualification_match": 0, "technical_score": 0,
  "communication_score": 0, "problem_solving_score": 0, "answer_quality_score": 0,
  "project_contribution_score": 0, "repository_challenge_score": 0,
  "code_correctness": "correct|incorrect|unverified|not_completed",
  "approach_comparison": "better_approach|same_approach|same_grade_different_approach|lower_grade_approach|not_evaluated",
  "language_skills": [],
  "basic_insights": [], "strengths": [], "concerns": [], "hire_reasons": [],
  "reject_reasons": [], "final_recommendation": "Strong Hire"
}}

The recommendation must be one of: Strong Hire, Hire, Consider, Do Not Hire."""
