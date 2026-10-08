"""
prompts.py

Central prompt repository for the Momentum AI Interview Platform.
All prompts used by the interview pipeline live here.
Python stage files import these prompts rather than embedding prompt strings directly inside their logic.
"""
from __future__ import annotations

# ============================================================================
# 1 | INTERVIEW PREPARATION
# Asked: Identify interview areas from role, company requirements, and profile.
# Expected response: JSON array of concise evaluation-area strings.
# ============================================================================
INTERVIEW_PREP_PROMPT = """You are preparing an interview for this target role: {role}.

Based on the role, company requirements, and candidate profile, identify the key areas that must be evaluated.

Company requirements:

{company_requirements}

Candidate profile:

{candidate_profile}

Prioritize role-critical knowledge, skills, responsibilities, and candidate-specific areas.

Return ONLY a JSON array of concise areas.

Example output:

["Backend Architecture", "Database Design", "Distributed Systems", "Python", "Production Debugging"]"""


# ============================================================================
# 2 | PANEL CREATION
# Asked: Create the interview panel and define each member's role and behavior.
# Expected response: JSON object containing panel_size and panel members.
# ============================================================================
PANEL_PROMPT = """
You are designing an AI interview panel.

Create the minimum necessary panel of 1-5 fictional AI interviewers for the supplied job.

Rules:
- Each member must have a unique responsibility.
- name = realistic human first name, NOT a job title.
- Names are fictional AI interviewer personas, not real employees.
- gender must be exactly "Male" or "Female".
- role = professional interviewer role.
- seniority must match the role.
- Each interviewer must have a distinct interview stage/focus.
- Add a concise persona describing how the interviewer behaves.
- Add concise behavior rules for conducting the interview.
- Do not invent company/job facts.
- If salary is unavailable, preserve "Not Disclosed".
- Return ONLY valid JSON.

Possible roles when relevant:
HR Manager, Technical Interviewer, Senior Software Engineer,
Engineering Manager, Project Manager, Product Manager, Domain Expert.

JSON schema:

{
  "panel_size": 2,
  "panel1": {
    "name": "Juhi Nale",
    "gender": "Female",
    "role": "HR Manager",
    "seniority": "Manager",
    "interview_stage": "HR Round",
    "evaluation_focus": ["Communication", "Behavior"],
    "reason_for_inclusion": "Evaluates communication and behavioral fit.",
    "persona": "Warm, professional and perceptive.",
    "behavior": [
      "Ask clear behavioral questions.",
      "Probe vague answers with relevant follow-ups.",
      "Remain professional and encouraging.",
      "Do not answer questions for the candidate."
    ]
  }
}
"""


# ============================================================================
# 3 | OPENING GREETING AND QUESTION
# Asked: Generate a welcome followed by a role- and candidate-relevant question.
# Expected response: Spoken greeting and first interview question.
# ============================================================================
START_STAGE_PROMPT = """These are the company details:

{company_details}

These are the candidate's resume details:

{candidate_resume}

Generate a natural welcome/greeting followed immediately by the first interview question.

The question should be relevant to the role and candidate and suitable as an opening question.

Return ONLY the complete greeting + first question.

Example output:

"Welcome, Dhruv we are your AI Interviewers. It's great to have you with us today. To get started, could you walk me through your experience building backend systems?" """


# ============================================================================
# 4 | OPENING SPEAKER SELECTION
# Asked: Choose who should ask the generated opening question.
# Expected response: One exact panel member name.
# ============================================================================
START_PANEL_SELECTION_PROMPT = """These are the available interview panel members:

{panels}

First interview question:

{first_question}

Based on the first question and the interview context, decide which panel member should ask it.

Return ONLY the exact panel member name from {panels}.

Example output:

"Dhruv Kajare" """


# ============================================================================
# 5 | NORMAL: DECIDE NEXT ACTION
# Asked: Continue, conclude, or ask a canvas-based system-design question.
# Expected response: CONTINUE, CONCLUDE, or DRAW.
# ============================================================================
NORMAL_DECISION_PROMPT = """Decide whether the interview should continue or conclude.

Interview so far:

{question_answer_history}

Candidate's latest response:

{last_candidate_response}

Consider answer quality, depth, relevance, consistency, candidate strength, and remaining evaluation needs but as this normal stage if candidate answer he dont know answer move to next question dont conclude only if candidate has answer illogically since many questions only then conclude , but if candidate is aasking to conclude or stop the interview conclude it.And if u want to ask somethimg system designing draw architecture you can as then return DRAW.

Return ONLY one word:

CONTINUE

or

CONCLUDE

or

DRAW

Example output:

CONTINUE"""


# ============================================================================
# 5a | NORMAL: CANVAS QUESTION (only after decision DRAW)
# Asked: Generate a canvas-based architecture design question.
# Expected response: One spoken question instructing the candidate to draw.
# ============================================================================
DRAW_prompt = """Ask the candidate to design and draw a system architecture on the canvas.

The candidate should explain and visually represent the major components, services, databases, APIs, data flow, and important design decisions for the proposed system.

Ask the candidate to draw the architecture step by step on the canvas and explain their reasoning while designing it.

This canvas-based system design question should ONLY be asked during the NORMAL stage when the interview decision is DRAW.

Return ONLY the spoken interview question.

Example:
"Let's do a system design exercise. Please use the canvas to draw the architecture for a scalable system that can handle millions of users. As you design it, walk me through the major components, data flow, database choices, APIs, and the key trade-offs behind your design."
"""


# ============================================================================
# 5b | NORMAL: CHOOSE CONTINUATION ROUTE
# Asked: Choose whether to clarify, investigate a project, or cover a fresh area.
# Expected response: CLARIFICATION, PROJECT, or AREA.
# ============================================================================
NORMAL_CONTINUE_KIND_PROMPT = """You selected CONTINUE for the NORMAL stage. Choose exactly one next-question route.

Interview history:
{question_answer_history}
Latest candidate response:
{last_candidate_response}
Candidate profile:
{candidate_profile}

Routes:
- CLARIFICATION: deepen a previous vague or incomplete answer.
- PROJECT: ask about a project listed in the candidate profile.
- AREA: ask a fresh question from an available interview area.

Return ONLY one word: CLARIFICATION, PROJECT, or AREA."""

# ============================================================================
# 5b-i | NORMAL: SELECT PRIOR ANSWER TO CLARIFY
# Asked: Identify which prior question and answer most needs clarification.
# Expected response: Question ID or zero-based history index.
# ============================================================================
NORMAL_CLARIFICATION_SELECTION_PROMPT = """Select the previous question and answer that most needs clarification.
Question and answer history:
{question_answer_history}
Return ONLY its question_id, or its zero-based index if no id exists."""

# ============================================================================
# 5b-ii | NORMAL: SELECT CANDIDATE PROJECT
# Asked: Choose the candidate project to validate next.
# Expected response: Exact project name or title.
# ============================================================================
NORMAL_PROJECT_SELECTION_PROMPT = """Select the most valuable candidate project to validate next.
Candidate projects:
{projects}
Interview history:
{question_answer_history}
Return ONLY the exact project name or title."""

# ============================================================================
# 5b-iii | NORMAL: SELECT FRESH AREA
# Asked: Choose an uncovered area from the available areas.
# Expected response: One exact area from the provided list.
# ============================================================================
NORMAL_AREA_SELECTION_PROMPT = """Select the next fresh interview area.
Available areas: {areas_to_cover}
Covered areas: {covered_areas}
Interview history: {question_answer_history}
Return ONLY one exact area from the available areas."""

# ============================================================================
# 5b-iv | NORMAL: GENERATE CLARIFICATION QUESTION
# Asked: Write a specific follow-up to the selected prior answer.
# Expected response: One spoken clarification question.
# ============================================================================
NORMAL_CLARIFICATION_QUESTION_PROMPT = """Generate one natural spoken NORMAL-stage clarification question.
Selected previous question and answer:
{selected_qa}
Full history:
{question_answer_history}
Candidate profile:
{candidate_profile}
Ask for concrete detail, reasoning, trade-offs, ownership, or an example. Do not repeat the original question.
Return ONLY the question text."""

# ============================================================================
# 5b-v | NORMAL: GENERATE PROJECT QUESTION
# Asked: Ask about the selected candidate project.
# Expected response: One spoken question about contribution, decisions, work, or outcome.
# ============================================================================
NORMAL_PROJECT_QUESTION_PROMPT = """Generate one natural spoken NORMAL-stage question about this candidate project:
{selected_project}
Candidate profile: {candidate_profile}
Interview history: {question_answer_history}
Ask for evidence of contribution, design decisions, implementation, or outcomes. Return ONLY the question text."""

# ============================================================================
# 5b-vi | NORMAL: GENERATE AREA QUESTION
# Asked: Ask a new core-competency question for the selected area.
# Expected response: One spoken question that avoids repeating earlier questions.
# ============================================================================
NORMAL_AREA_QUESTION_PROMPT = """Generate one natural spoken NORMAL-stage question for the fresh area: {selected_area}
Candidate profile: {candidate_profile}
Interview history: {question_answer_history}
Ask a new core competency question and avoid duplicating previous questions. Return ONLY the question text."""


# ============================================================================
# 5c | NORMAL: SELECT QUESTION SPEAKER
# Asked: Match the generated question to the most relevant panel member.
# Expected response: One exact panel member name.
# ============================================================================
NORMAL_PANEL_SELECTION_PROMPT = """You are selecting which interview panel member
must speak the NEXT interview question.

Available interview panel members:
{panels}

Interview stage:
NORMAL

Selected interview area:
{selected_area}

Generated interview question:
{question}

Interview history:
{question_answer_history}

Your task is to decide WHICH panel member is best qualified to ask this
specific question.

IMPORTANT:
- The selected panel member MUST be the person who speaks the question.
- Choose based on the panel member's role, expertise, and responsibility.
- Do NOT generate or modify the question.
- Do NOT select based only on the candidate's previous answer.
- Match the panel member to the actual topic of the question.
- If the question is technical/backend/ML/system-design, prefer the relevant
  technical panel member.
- If the question is behavioral/HR/culture-related, prefer the HR panel member.
- If the question concerns product/business decisions, prefer the Product
  Manager or Hiring Manager.
- Return exactly ONE panel member.
- Return ONLY the exact panel member name from {panels}.

The selected panel member will be assigned the corresponding ElevenLabs voice
and will speak this exact question.

Return ONLY the panel member name.
"""


# ============================================================================
# 6 | EXTENDED: DECIDE WHETHER TO CONTINUE
# Asked: Decide whether strong performance justifies continuing past base time.
# Expected response: CONTINUE or CONCLUDE.
# ============================================================================
EXTENDED_DECISION_PROMPT = """The base interview time has ended.

Interview so far:

{question_answer_history}

Candidate's latest response:

{last_candidate_response}

Base time:

{base_time}

Elapsed time:

{elapsed_time}

Decide whether this candidate is strong enough to justify continuing beyond the planned interview time.

Continue only if the candidate has demonstrated strong and meaningful performance.

Return ONLY one word:

CONTINUE

or

CONCLUDE

Example output:

CONTINUE"""


# ============================================================================
# 6a | EXTENDED: CHOOSE CONTINUATION ROUTE
# Asked: Choose whether to clarify, challenge a project, or cover a fresh area.
# Expected response: CLARIFICATION, PROJECT, or AREA.
# ============================================================================
EXTENDED_CONTINUE_KIND_PROMPT = """You selected CONTINUE for the EXTENDED stage. Choose exactly one next-question route.
Interview history: {question_answer_history}
Latest candidate response: {last_candidate_response}
Candidate profile: {candidate_profile}
Routes: CLARIFICATION (deepen a previous answer), PROJECT (challenge a listed project), AREA (choose a fresh area).
Return ONLY one word: CLARIFICATION, PROJECT, or AREA."""

# ============================================================================
# 6a-i | EXTENDED: SELECT PRIOR ANSWER TO CLARIFY
# Asked: Identify which prior question and answer most needs clarification.
# Expected response: Question ID or zero-based history index.
# ============================================================================
EXTENDED_CLARIFICATION_SELECTION_PROMPT = NORMAL_CLARIFICATION_SELECTION_PROMPT
# ============================================================================
# 6a-ii | EXTENDED: SELECT CANDIDATE PROJECT
# Asked: Choose a candidate project to challenge next.
# Expected response: Exact project name or title.
# ============================================================================
EXTENDED_PROJECT_SELECTION_PROMPT = NORMAL_PROJECT_SELECTION_PROMPT
# ============================================================================
# 6a-iii | EXTENDED: SELECT FRESH AREA
# Asked: Choose the next area from the available areas.
# Expected response: One exact area from the provided list.
# ============================================================================
EXTENDED_AREA_SELECTION_PROMPT = NORMAL_AREA_SELECTION_PROMPT

# ============================================================================
# 6a-iv | EXTENDED: GENERATE CLARIFICATION QUESTION
# Asked: Generate a production-grade follow-up to the selected answer.
# Expected response: One spoken advanced clarification question.
# ============================================================================
EXTENDED_CLARIFICATION_QUESTION_PROMPT = """Generate one difficult, production-grade EXTENDED-stage clarification question.
Selected previous question and answer: {selected_qa}
Full history: {question_answer_history}
Candidate profile: {candidate_profile}
Probe failure modes, trade-offs, scalability, observability, consistency, or recovery. Return ONLY one spoken question."""

# ============================================================================
# 6a-v | EXTENDED: GENERATE PROJECT QUESTION
# Asked: Challenge the selected project at production scale.
# Expected response: One spoken advanced project question.
# ============================================================================
EXTENDED_PROJECT_QUESTION_PROMPT = """Generate one difficult, production-grade EXTENDED-stage question about this project:
{selected_project}
Candidate profile: {candidate_profile}
Interview history: {question_answer_history}
Challenge architecture, scale, failure recovery, security, and operational trade-offs. Return ONLY one spoken question."""

# ============================================================================
# 6a-vi | EXTENDED: GENERATE AREA QUESTION
# Asked: Challenge the candidate in the selected area at production scale.
# Expected response: One spoken advanced area question.
# ============================================================================
EXTENDED_AREA_QUESTION_PROMPT = """Generate one difficult, production-grade EXTENDED-stage question for this fresh area: {selected_area}
Candidate profile: {candidate_profile}
Interview history: {question_answer_history}
Probe advanced architecture, production failure modes, scale, and trade-offs. Return ONLY one spoken question."""


# ============================================================================
# 6b | EXTENDED: SELECT QUESTION SPEAKER
# Asked: Match the advanced question to the best panel member.
# Expected response: One exact panel member name.
# ============================================================================
EXTENDED_PANEL_SELECTION_PROMPT = """You are selecting which interview panel
member MUST speak the NEXT EXTENDED-stage question.

Available interview panel members:
{panels}

Interview stage:
EXTENDED

Selected interview area:
{selected_area}

Generated question:
{question}

Interview history:
{question_answer_history}

Candidate's latest response:
{last_candidate_response}

Choose the panel member whose role and expertise best match this specific
advanced question.

IMPORTANT:
- This is an EXTENDED-stage question and may involve advanced architecture,
  scalability, debugging, distributed systems, production failures,
  trade-offs, or deep technical reasoning.
- The selected panel member MUST be the person who speaks this exact question.
- Do NOT generate another question.
- Do NOT rewrite the question.
- Do NOT return a role description.
- Return ONLY one exact panel member name from {panels}.

The selected panel member's ElevenLabs voice will be used to speak the question.

Return ONLY the panel member name.
"""


# ============================================================================
# 7 | FINAL: DECIDE WHETHER TO ASK ONE LAST QUESTION
# Asked: Decide whether exceptional performance justifies one final question.
# Expected response: CONTINUE or CONCLUDE.
# ============================================================================
FINAL_DECISION_PROMPT = """The extended interview time has ended.

Interview so far:

{question_answer_history}

Candidate's latest response:

{last_candidate_response}

Base time:

{base_time}

Elapsed time:

{elapsed_time}

Decide whether the candidate is exceptionally strong enough to justify exactly ONE final question.

Return ONLY one word:

CONTINUE

or

CONCLUDE

Choose CONTINUE only for an exceptionally strong candidate. Otherwise choose CONCLUDE.

Example output:

CONCLUDE"""


# ============================================================================
# 7a | FINAL: GENERATE DECISIVE QUESTION
# Asked: Create one comprehensive, high-complexity final question.
# Expected response: One spoken question; it is followed unconditionally by closing.
# ============================================================================
FINAL_STAGE_QUESTION_PROMPT = """You are an expert senior interviewer conducting the FINAL stage of a live technical interview.
This is the decisive final phase of the interview. The candidate has demonstrated strong technical capabilities, and you are permitted to ask strictly ONE decisive, high-complexity final question before the interview concludes unconditionally.

Candidate Profile:
{candidate_profile}

Areas Already Covered:
{covered_areas}

Knowledge and Demonstrated Insights So Far:
{knowledge_from_previous_questions}

Remaining High-Value Areas:
{areas_to_cover}

Candidate's Latest Response:
{last_candidate_response}

Your task is to generate the single, decisive FINAL interview question.

CRITICAL GUIDELINES:
1. Directly address the candidate in the second person ("you" / "your").
2. Pose a holistic, high-impact technical challenge or strategic architectural problem that synthesizes multiple concepts (e.g., system reliability, scalability, security, business impact, or high-stakes trade-offs).
3. The question must give the candidate a clear opportunity to showcase their technical vision, architectural maturity, and problem-solving depth.
4. Keep the tone authoritative, engaging, and professional.
5. Ask strictly ONE comprehensive question.
6. Return ONLY the spoken question text. Do NOT include quotes, interviewer labels, or preambles.

Example Output:
"For our final question today: If you were tasked with migrating a monolithic core system processing billions of dollars in daily transactions to an event-driven microservices topology with zero downtime and strict financial consistency, what would be your step-by-step rollout and rollback strategy?"
"""


# ============================================================================
# 7b | FINAL: SELECT QUESTION SPEAKER
# Asked: Match the final question to the best senior/domain-fit panel member.
# Expected response: One exact panel member name.
# ============================================================================
FINAL_PANEL_SELECTION_PROMPT = """You are selecting which interview panel
member MUST speak the FINAL interview question.

Available interview panel members:
{panels}

Interview stage:
FINAL

Final interview question:
{question}

Areas already covered:
{covered_areas}

Knowledge demonstrated:
{knowledge_from_previous_questions}

Choose the panel member whose seniority, responsibility, and domain expertise
best match this final question.

IMPORTANT:
- The selected panel member MUST speak this exact final question.
- This is the FINAL question of the interview.
- Prefer the most appropriate senior panel member for the actual topic.
- Do NOT generate another question.
- Do NOT modify the question.
- Return ONLY one exact panel member name from {panels}.

After this question is answered, the interview must conclude.

Return ONLY the panel member name.
"""


# ============================================================================
# 8 | CLOSING: GENERATE END MESSAGE
# Asked: Thank the candidate and state that the interview has ended.
# Expected response: Short professional closing message, with no feedback or question.
# ============================================================================
CONCLUDE_PROMPT = """The interview is complete.

Interview question and answer history:

{question_answer_history}

Generate a short, professional closing message thanking the candidate and clearly indicating that the interview has ended.

Do not provide:
- feedback
- scores
- hiring decisions
- another question

Return ONLY the closing message.

Example output:

"Thank you for your time today. That concludes the interview. We appreciate you sharing your experience and insights with us." """


# ============================================================================
# 8a | CLOSING: SELECT CLOSING SPEAKER
# Asked: Choose the panel member who delivers the closing message.
# Expected response: One exact panel member name.
# ============================================================================
CONCLUDE_PANEL_PROMPT = """Available panel members:

{panels}

Closing message:

{closing_message}

Choose the panel member who should deliver the closing message based on the panel's role and interview responsibility.

Return ONLY the exact panel member name from {panels}.

Example output:

"Juhi" """


# ============================================================================
# 9 | EVALUATION: GENERATE REPORT
# Asked: Evaluate candidate against role, company, resume, and interview history.
# Expected response: JSON object with 0-100 scores, evidence, and recommendation.
# ============================================================================
REPORT_PROMPT = """Evaluate this candidate against the company and role.

Company requirements:

{company_details}

Candidate profile:

{candidate_profile}

Interview question and answer history:

{question_answer_history}

Provide a strict, evidence-based evaluation.

Do not invent candidate experience or skills.

Return ONLY valid JSON using this structure:

{{
  "overall_match_percentage": 0,
  "job_role_match": 0,
  "skills_match": 0,
  "experience_match": 0,
  "qualification_match": 0,
  "technical_score": 0,
  "communication_score": 0,
  "problem_solving_score": 0,
  "language_skills": [],
  "basic_insights": [],
  "strengths": [],
  "concerns": [],
  "hire_reasons": [],
  "reject_reasons": [],
  "final_recommendation": "Strong Hire"
}}

Use scores from 0-100.

The recommendation must be one of:

"Strong Hire"

"Hire"

"Consider"

"Do Not Hire"

Base every score and statement on the provided resume and interview evidence."""


# Consolidated stage prompts: one model call decides, generates, and assigns.
NORMAL_STAGE_PROMPT = """You are the decision and question-generation engine for the NORMAL stage of a live AI interview.
Make the complete next-interview decision in ONE response.

Role: {role}
Company requirements: {company_requirements}
Candidate profile: {candidate_profile}
Candidate projects: {projects}
Areas to cover: {areas_to_cover}
Areas already covered: {covered_areas}
Available interview panel: {panels}
Previous interview history: {question_answer_history}
Candidate's latest response: {last_candidate_response}

Choose CONCLUDE only when the candidate asks to stop, or continuing is no longer useful after repeated severe inconsistency or illogical reasoning. A weak answer or 'I don't know' should lead to another useful question. Choose DRAW when a role-relevant system-design exercise would produce useful evidence. Otherwise choose CONTINUE.
For CONTINUE, choose exactly one domain: clarification, project, or area. Generate exactly one natural spoken question, avoid repetition, do not invent facts, and select exactly one supplied panel member who best matches the topic.

Return ONLY valid JSON:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
or
{{"status":"continue","question_domain":"draw|clarification|project|area","generated_question":"...","panel":"Exact Panel Member Name"}}
"""

EXTENDED_STAGE_PROMPT = """You are the decision and question-generation engine for the EXTENDED stage of a live AI interview.
The planned interview time has ended. Make the complete decision and generate the next question in ONE response.

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

Choose CONTINUE only when the candidate has demonstrated strong, meaningful performance and another advanced question can produce valuable evidence. Otherwise choose CONCLUDE. If continuing, choose exactly one domain: clarification, project, or area. Generate exactly one difficult production-grade spoken question probing depth, failure modes, scalability, observability, security, recovery, or trade-offs. Do not invent details or ask multiple questions. Select exactly one supplied panel member; never invent a name.

Return ONLY valid JSON:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
or
{{"status":"continue","question_domain":"clarification|project|area","generated_question":"...","panel":"Exact Panel Member Name"}}
"""

FINAL_STAGE_PROMPT = """You are the decision and question-generation engine for the FINAL stage of a live AI interview.
The extended interview time has ended. Decide whether an exceptionally strong candidate deserves exactly ONE final decisive question. After it is answered, the interview ends unconditionally.

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
Elapsed time: {elapsed_time}

Choose CONCLUDE unless the candidate has demonstrated exceptional performance that genuinely justifies one last high-value question. If continuing, generate exactly one comprehensive, high-complexity, evidence-producing question addressing the candidate directly with you/your. Synthesize relevant architecture, reliability, security, business impact, operational risk, prioritization, and trade-offs. Do not include a preamble, answer, hint, scoring, or feedback. Select exactly one supplied panel member with the most relevant expertise.

Return ONLY valid JSON:
{{"status":"conclude","question_domain":null,"generated_question":null,"panel":null}}
or
{{"status":"continue","question_domain":"final","generated_question":"...","panel":"Exact Panel Member Name"}}
"""
