"""
prompts.py

Central prompt repository for the EchoSphere AI Interview Platform.
All prompts used by the interview pipeline live here.
Python stage files import these prompts rather than embedding prompt strings directly inside their logic.
"""
from __future__ import annotations

# ============================================================================
# 1. INTERVIEW PREPARATION
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
# 2. PANEL SELECTION - AI PANEL CREATION
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
# 3. START STAGE - GREETING & FIRST QUESTION GENERATION
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
# 4. START STAGE - PANEL SELECTION FOR FIRST QUESTION
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
# 5. NORMAL STAGE - DECISION (CONTINUE / CONCLUDE / DRAW)
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
# 6. NORMAL STAGE - SYSTEM DESIGN / ARCHITECTURE CANVAS QUESTION
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
# 7. NORMAL STAGE - TOPIC & DIRECTION SELECTION
# ============================================================================
NORMAL_DIRECTION_PROMPT = """Based on the interview so far, choose what should be asked next.

Interview so far:

{question_answer_history}

Areas to cover:

{areas_to_cover}

Candidate profile:

{candidate_profile}

Choose the most valuable next direction based on an uncovered area, candidate project, candidate skill, or meaningful follow-up and if candidate was not able to answer last question start with okay no issue it happens sometime and then start the question.

Return ONLY one concise area/topic.

Example output:

"Distributed Systems" """


# ============================================================================
# 8. NORMAL STAGE - ROLE AREA SELECTION
# ============================================================================
ROLE_AREA_PROMPT = """Choose the next uncovered area to evaluate.

Covered areas:

{covered_areas}

Remaining areas:

{remaining_areas}

Candidate profile:

{candidate_profile}

Choose the most important remaining area for the target role.

Return ONLY the area.

Example output:

"Database Scalability" """


# ============================================================================
# 9. NORMAL STAGE - QUESTION GENERATION
# ============================================================================
NORMAL_STAGE_QUESTION_PROMPT = """You are an expert technical interviewer conducting the NORMAL stage of a live voice interview with a candidate.

Candidate Profile:
{candidate_profile}

Candidate Context / Specific Skills or Projects:
{candidate_context}

Selected Interview Area:
{selected_area}

Interview Transcript & History So Far:
{question_answer_history}

Candidate's Latest Response:
{last_candidate_response}

Your task is to generate the next spoken interview question for the candidate in the NORMAL stage.

CRITICAL GUIDELINES:
1. Directly address the candidate in the second person ("you" / "your").
2. Focus on core technical competence, validating actual projects and skills mentioned, and probing real-world problem-solving in the "{selected_area}" domain.
3. If the candidate successfully answered the previous question, transition smoothly and naturally into this next topic or probe a meaningful nuance of what they shared.
4. If the candidate struggled or stated they did not know the previous answer, be encouraging, professional, and conversational (e.g., "No problem at all, let's explore another area...") and smoothly introduce this new question.
5. NEVER include internal meta-commentary, evaluation notes, brackets, or negative criticisms (e.g. do NOT say "As you failed to answer...", "Since the candidate didn't mention...").
6. The output must be a PURE, natural, highly professional spoken question ready to be read aloud directly to the candidate.
7. Return ONLY the spoken question text. Do NOT include quotes, interviewer labels, or preambles.

Example Output:
"You mentioned using Redis and PostgreSQL in your recent e-commerce project. How did you handle cache invalidation to ensure users never saw stale pricing or inventory during flash sales?"
"""


# ============================================================================
# 10. NORMAL STAGE - PANEL SELECTION FOR QUESTION
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


# Backward-compatibility alias (used by any code still importing PANEL_SELECTION_PROMPT)
PANEL_SELECTION_PROMPT = NORMAL_PANEL_SELECTION_PROMPT


# ============================================================================
# 11. EXTENDED STAGE - DECISION (CONTINUE / CONCLUDE)
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
# 12. EXTENDED STAGE - TOPIC & DIRECTION SELECTION
# ============================================================================
EXTENDED_DIRECTION_PROMPT = """Choose the most valuable next interview direction.

Interview so far:

{question_answer_history}

Areas to cover:

{areas_to_cover}

Candidate profile:

{candidate_profile}

Choose the most valuable uncovered area, candidate project, skill, or meaningful follow-up.

Return ONLY one concise area/topic.

Example output:

"High-Scale System Design" """


# ============================================================================
# 13. EXTENDED STAGE - ADVANCED QUESTION GENERATION
# ============================================================================
EXTENDED_STAGE_QUESTION_PROMPT = """You are an expert technical interviewer conducting the EXTENDED stage of a live voice interview with a candidate.
The candidate has performed well during the base interview time and is now being challenged with deeper, advanced, and production-level scenarios.

Candidate Profile:
{candidate_profile}

Candidate Context / Specific Skills or Projects:
{candidate_context}

Selected Interview Area:
{selected_area}

Interview Transcript & History So Far:
{question_answer_history}

Candidate's Latest Response:
{last_candidate_response}

Your task is to generate a challenging, in-depth technical interview question for the EXTENDED stage.

CRITICAL GUIDELINES:
1. Directly address the candidate in the second person ("you" / "your").
2. Probe advanced engineering trade-offs, high-concurrency bottlenecks, distributed failure modes, production outages, latency spikes, data consistency, or recovery strategies in the "{selected_area}" domain.
3. Challenge the candidate to justify architectural choices, defend trade-offs (e.g., consistency vs. latency, horizontal vs. vertical scaling), and think through edge cases under heavy production load.
4. Keep the question engaging, rigorous, and conversational—spoken directly to the candidate.
5. NEVER include internal meta-criticism or evaluation commentary (e.g., do NOT say "Since you didn't explain...").
6. Return ONLY the single spoken question text. Do NOT include quotes, interviewer labels, or preambles.

Example Output:
"In your distributed architecture, suppose a sudden 10x traffic spike causes your primary message queue to back up and downstream worker nodes begin timing out intermittently. How would you design backpressure and rate limiting so the core service remains available without dropping mission-critical events?"
"""


# ============================================================================
# 14. EXTENDED STAGE - PANEL SELECTION FOR QUESTION
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
# 15. FINAL STAGE - DECISION (CONTINUE / CONCLUDE)
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
# 16. FINAL STAGE - DECISIVE FINAL QUESTION GENERATION
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
# 17. FINAL STAGE - PANEL SELECTION FOR FINAL QUESTION
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
# 18. CONCLUSION - CLOSING MESSAGE GENERATION
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
# 19. CONCLUSION - PANEL SELECTION FOR CLOSING MESSAGE
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
# 20. CONCLUSION - VOICE TTS CLOSING DELIVERY
# ============================================================================
ElevenLabs_CLOSING_PROMPT = """Speak this closing message naturally as the selected interview panel member:

{closing_message}

Do not add feedback.

Do not add a hiring decision.

Do not ask another question.

This is the final spoken message of the interview."""


# ============================================================================
# 21. EVALUATION REPORT GENERATION
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


# ============================================================================
# BACKWARD COMPATIBILITY ALIASES
# ============================================================================
PROJECT_QUESTION_PROMPT = NORMAL_STAGE_QUESTION_PROMPT
SKILL_QUESTION_PROMPT = NORMAL_STAGE_QUESTION_PROMPT
EXTENDED_PROJECT_QUESTION_PROMPT = EXTENDED_STAGE_QUESTION_PROMPT
EXTENDED_SKILL_QUESTION_PROMPT = EXTENDED_STAGE_QUESTION_PROMPT
FINAL_QUESTION_PROMPT = FINAL_STAGE_QUESTION_PROMPT

ElevenLabs_QUESTION_GENERATION_PROMPT = NORMAL_STAGE_QUESTION_PROMPT
ElevenLabs_SKILL_QUESTION_PROMPT = NORMAL_STAGE_QUESTION_PROMPT
ElevenLabs_EXTENDED_QUESTION_PROMPT = EXTENDED_STAGE_QUESTION_PROMPT
ElevenLabs_FINAL_QUESTION_PROMPT = FINAL_STAGE_QUESTION_PROMPT
