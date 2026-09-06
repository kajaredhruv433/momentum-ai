"""
prompts.py

Central prompt repository for the EchoSphere AI Interview Platform.
All prompts used by the interview pipeline live here.
Python stage files import these prompts rather than embedding prompt strings directly inside their logic.
"""
from __future__ import annotations

# ============================================================================
# 4. INTERVIEW PREPARATION
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
# 5. START STAGE
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
# 6. START PANEL SELECTION
# ============================================================================
START_PANEL_SELECTION_PROMPT = """These are the available interview panel members:

{panels}

First interview question:

{first_question}

Based on the first question and the interview context, decide which panel member should ask it.

Return ONLY the exact panel member name from {panels}.

Example output:

"Dhruv kajare" """


# ============================================================================
# 9. NORMAL STAGE - DECISION
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
# 10.1 system design prompt
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
# 11. NORMAL STAGE - DIRECTION
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
# 12. ROLE/AREA PATH
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
# 13. PROJECT PATH - GROQ QUESTION PATTERN
# ============================================================================
PROJECT_QUESTION_PROMPT = """Create a practical question-generation instruction for Agora using the candidate's project.

Candidate projects:

{candidate_projects}

Selected area:

{selected_area}

Connect something the candidate actually built to the selected area and test how the candidate would handle a realistic problem.

Prefer a pattern such as:

"You built X; how would you handle Y?"

Decide whether the question should:
1. Reference something the candidate already said, or
2. Introduce a fresh scenario.

Return ONLY a concise question-generation instruction for Agora.

Do NOT write the final polished interview question.

Example output:

"As the candidate mentioned earlier that they built a Redis caching system, ask how they would handle a cache stampede during a sudden traffic spike." """


# ============================================================================
# 14. AGORA QUESTION GENERATION PROMPT (Sent to Agora Conversational AI LLM)
# ============================================================================
AGORA_QUESTION_GENERATION_PROMPT = """You are speaking directly to a candidate in a live technical interview.
Internal question direction from the reasoning agent:

{question_pattern}

Generate the actual, pure interview question you will speak aloud to the candidate.

CRITICAL INSTRUCTIONS:
1. Speak directly to the candidate using second person ('you' / 'your').
2. The question must be a PURE, direct, professional interview question.
3. NEVER include negative evaluation commentary, meta-criticism, or internal rationale such as:
   - "As you were not able to..."
   - "Since you haven't addressed..."
   - "Because you didn't mention..."
   - "As the candidate was not able to..."
4. Never state what the candidate did or did not fail to answer in previous turns.
5. Transform the core technical scenario directly into an engaging, natural interview question.
6. Return ONLY the single spoken question. Do NOT include quotes, intros, or labels."""


# ============================================================================
# 15. PANEL SELECTION (Takes question_pattern from Groq)
# ============================================================================
PANEL_SELECTION_PROMPT = """Available panel members:

{panels}

Selected interview area:

{selected_area}

Question-generation instruction:

{question_pattern}

Choose the panel member whose role and expertise best match this interview topic.

Return ONLY the exact panel member name from {panels}.

Example output:

"Dhruv" """


# ============================================================================
# 16. SKILL PATH - GROQ QUESTION PATTERN
# ============================================================================
SKILL_QUESTION_PROMPT = """Create a concise question-generation instruction for Agora that tests the candidate's practical understanding of this skill.

Candidate skills:

{candidate_skills}

Selected area:

{selected_area}

Focus on real-world application rather than memorization.

Decide whether to reference the candidate's previous answer or ask a fresh question.

Return ONLY the question-generation instruction for Agora.

Do NOT write the final polished interview question.

Example output:

"As the candidate mentioned Python backend development earlier, ask how they would design the API to remain reliable under thousands of simultaneous requests." """


AGORA_SKILL_QUESTION_PROMPT = """Using this instruction from the reasoning agent:

{question_pattern}

Generate the actual interview question.

Naturally reference the candidate's previous answer only if the instruction asks for it.

Otherwise generate a fresh question around the requested topic.

Ask ONLY one question."""


# ============================================================================
# 18. EXTENDED STAGE - DECISION
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
# 19. EXTENDED STAGE - DIRECTION
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
# 20. EXTENDED PROJECT PATTERN
# ============================================================================
EXTENDED_PROJECT_QUESTION_PROMPT = """Create a difficult question-generation instruction for Agora.

Candidate projects:

{candidate_projects}

Selected area:

{selected_area}

Connect the candidate's actual project experience to a difficult real-world scenario.

Test deeper reasoning, trade-offs, scalability, failure handling, or design decisions.

Decide whether to:
1. Reference something the candidate already said, or
2. Ask a fresh difficult scenario.

Return ONLY a concise question-generation instruction for Agora.

Do NOT write the final polished interview question.

Example output:

"As the candidate mentioned earlier that they built a distributed backend service, ask how they would redesign it if one dependency started failing intermittently under heavy production traffic." """


# ============================================================================
# 21. EXTENDED SKILL PATTERN
# ============================================================================
EXTENDED_SKILL_QUESTION_PROMPT = """Create a difficult question-generation instruction for Agora.

Candidate skills:

{candidate_skills}

Selected area:

{selected_area}

Test deeper reasoning, trade-offs, debugging, scalability, failure handling, or real-world application.

Decide whether to reference the candidate's previous response or ask a fresh question.

Return ONLY a concise question-generation instruction for Agora.

Do NOT write the final polished interview question.

Example output:

"As the candidate previously described working with Python APIs, ask how they would diagnose and fix a sudden latency increase in the production service." """


AGORA_EXTENDED_QUESTION_PROMPT = """Using this instruction from the reasoning agent:

{question_pattern}

Generate the actual difficult interview question.

If previous candidate context is referenced, naturally incorporate it.

Otherwise create a fresh question around the requested scenario.

Ask ONLY one question."""


# ============================================================================
# 22. FINAL STAGE - DECISION
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
# 23. FINAL QUESTION PATTERN
# ============================================================================
FINAL_QUESTION_PROMPT = """This will be the final interview question.

Areas already covered:

{covered_areas}

Candidate knowledge demonstrated so far:

{knowledge_from_previous_questions}

Valuable remaining areas:

{areas_to_cover}

Candidate profile:

{candidate_profile}

Choose the single most valuable final topic/question direction.

Create a concise question-generation instruction for Agora.

Decide whether to reference something the candidate previously said or ask a fresh final question.

Return ONLY the question-generation instruction.

Do NOT write the final polished interview question.

Example output:

"As the candidate previously demonstrated experience with distributed systems, ask one final question about maintaining availability during a regional failure." """


# ============================================================================
# 24. FINAL PANEL SELECTION
# ============================================================================
FINAL_PANEL_SELECTION_PROMPT = """Available panel members:

{panels}

Final question-generation instruction:

{question_pattern}

Choose the panel member whose role and expertise best matches the final question.

Return ONLY the exact panel member name from {panels}.

Example output:

"Dhruv" """


# ============================================================================
# 25. AGORA FINAL QUESTION
# ============================================================================
AGORA_FINAL_QUESTION_PROMPT = """This is the FINAL interview question.

Using this instruction:

{question_pattern}

Generate the actual final interview question.

Ask ONLY one question.

Do not generate any additional question.

After the candidate answers, the interview MUST conclude."""


# ============================================================================
# 26. CONCLUSION
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
# 27. CLOSING PANEL
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
# 28. AGORA CLOSING
# ============================================================================
AGORA_CLOSING_PROMPT = """Speak this closing message naturally as the selected interview panel member:

{closing_message}

Do not add feedback.

Do not add a hiring decision.

Do not ask another question.

This is the final spoken message of the interview."""


# ============================================================================
# 29. REPORT
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
