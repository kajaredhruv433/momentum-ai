import os
import re
import json
import pymupdf as fitz
from docx import Document


# ============================================================
# TEXT EXTRACTION
# ============================================================

def extract_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF resume.
    """
    text = []

    doc = fitz.open(file_path)

    for page in doc:
        page_text = page.get_text("text")
        if page_text:
            text.append(page_text)

    doc.close()

    return "\n".join(text)


def extract_from_docx(file_path: str) -> str:
    """
    Extract text from a DOCX resume.
    """
    doc = Document(file_path)

    paragraphs = []

    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            paragraphs.append(paragraph.text)

    # Also extract text from tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    paragraphs.append(cell.text)

    return "\n".join(paragraphs)


def extract_from_txt(file_path: str) -> str:
    """
    Extract text from a TXT resume.
    """
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def extract_text(file_path: str) -> str:
    """
    Automatically determine the file type.
    """

    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".pdf":
        return extract_from_pdf(file_path)

    elif extension == ".docx":
        return extract_from_docx(file_path)

    elif extension == ".txt":
        return extract_from_txt(file_path)

    else:
        raise ValueError(
            f"Unsupported file type: {extension}. "
            "Supported formats: PDF, DOCX, TXT"
        )


# ============================================================
# BASIC INFORMATION
# ============================================================

def extract_email(text: str):
    match = re.search(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        text
    )

    return match.group(0) if match else None


def extract_phone(text: str):
    patterns = [
        r"(?:\+91[\s-]?)?[6-9]\d{9}",
        r"\+?\d{1,3}[\s-]?\d{10}",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            return match.group(0)

    return None


def extract_links(text: str):
    urls = re.findall(
        r"https?://[^\s]+",
        text
    )

    linkedin = None
    github = None
    portfolio = []

    for url in urls:
        clean_url = url.rstrip(".,)")

        if "linkedin.com" in clean_url.lower():
            linkedin = clean_url

        elif "github.com" in clean_url.lower():
            github = clean_url

        else:
            portfolio.append(clean_url)

    return {
        "linkedin": linkedin,
        "github": github,
        "portfolio": portfolio
    }


# ============================================================
# SECTION DETECTION
# ============================================================

SECTION_NAMES = {
    "summary": [
        "summary",
        "profile",
        "professional summary",
        "objective",
        "about me"
    ],

    "skills": [
        "skills",
        "technical skills",
        "technologies",
        "technical expertise"
    ],

    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment"
    ],

    "education": [
        "education",
        "academic background",
        "qualifications"
    ],

    "projects": [
        "projects",
        "personal projects",
        "academic projects"
    ],

    "certifications": [
        "certifications",
        "certificates"
    ],

    "achievements": [
        "achievements",
        "accomplishments",
        "awards"
    ]
}


def normalize_heading(line):
    return re.sub(
        r"[^a-zA-Z ]",
        "",
        line
    ).strip().lower()


def split_sections(text: str):

    lines = text.splitlines()

    sections = {}
    current_section = "other"

    sections[current_section] = []

    for line in lines:

        normalized = normalize_heading(line)

        detected = None

        for section, names in SECTION_NAMES.items():

            if normalized in names:
                detected = section
                break

        if detected:

            current_section = detected

            if current_section not in sections:
                sections[current_section] = []

        else:

            if line.strip():
                sections[current_section].append(
                    line.strip()
                )

    # Convert lists to strings
    for key in sections:
        sections[key] = "\n".join(sections[key])

    return sections


# ============================================================
# NAME EXTRACTION
# ============================================================

def extract_name(text: str):

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    # Usually the name is near the top of the resume
    for line in lines[:10]:

        # Ignore obvious headings
        if any(
            keyword in line.lower()
            for keyword in [
                "resume",
                "curriculum",
                "email",
                "phone",
                "linkedin",
                "github",
                "profile",
                "summary"
            ]
        ):
            continue

        # Names are usually 2-4 words
        words = line.split()

        if 2 <= len(words) <= 4:

            if all(
                re.match(
                    r"^[A-Za-z.'-]+$",
                    word
                )
                for word in words
            ):
                return line

    return None


# ============================================================
# SKILL EXTRACTION
# ============================================================

SKILL_DATABASE = [

    # Languages
    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "C",
    "C++",
    "C#",
    "Go",
    "Rust",
    "PHP",
    "Ruby",
    "Kotlin",
    "Swift",

    # Web
    "HTML",
    "CSS",
    "React",
    "Next.js",
    "Angular",
    "Vue",
    "Node.js",
    "Express",
    "FastAPI",
    "Django",
    "Flask",

    # AI / ML
    "Machine Learning",
    "Deep Learning",
    "Artificial Intelligence",
    "NLP",
    "Computer Vision",
    "LLM",
    "Generative AI",
    "LangChain",
    "PyTorch",
    "TensorFlow",
    "Scikit-learn",
    "Transformers",

    # Databases
    "MongoDB",
    "MySQL",
    "PostgreSQL",
    "Redis",
    "Qdrant",
    "Pinecone",
    "Firebase",

    # Cloud / DevOps
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "Git",
    "GitHub",
    "Linux",
    "CI/CD",

    # APIs / Architecture
    "REST API",
    "GraphQL",
    "Microservices",
    "WebSocket",

    # Other
    "SQL",
    "NoSQL",
    "Data Structures",
    "Algorithms"
]


def extract_skills(text: str):

    found = []

    text_lower = text.lower()

    for skill in SKILL_DATABASE:

        if skill.lower() in text_lower:
            found.append(skill)

    return sorted(
        list(set(found))
    )


# ============================================================
# EXPERIENCE
# ============================================================

def extract_years_of_experience(text: str):

    patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*experience",
        r"experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text.lower()
        )

        if match:
            return float(match.group(1))

    return None


# ============================================================
# EDUCATION
# ============================================================

DEGREE_KEYWORDS = [
    "B.Tech",
    "B.E",
    "Bachelor",
    "BSc",
    "B.Sc",
    "M.Tech",
    "M.E",
    "Master",
    "MSc",
    "M.Sc",
    "MBA",
    "PhD",
    "Ph.D"
]


def extract_education(text):

    education = []

    for line in text.splitlines():

        line_clean = line.strip()

        for degree in DEGREE_KEYWORDS:

            if degree.lower() in line_clean.lower():

                education.append(
                    line_clean
                )

                break

    return list(set(education))


# ============================================================
# PROJECT EXTRACTION
# ============================================================

def extract_projects(sections):

    projects_text = sections.get(
        "projects",
        ""
    )

    if not projects_text:
        return []

    lines = projects_text.splitlines()

    projects = []

    current_project = None

    for line in lines:

        line = line.strip()

        if not line:
            continue

        # A simple heuristic:
        # short lines are often project titles
        if len(line.split()) <= 8:

            if current_project:

                projects.append(
                    current_project
                )

            current_project = {
                "title": line,
                "description": ""
            }

        else:

            if current_project:

                current_project["description"] += (
                    " " + line
                )

    if current_project:
        projects.append(current_project)

    return projects


# ============================================================
# MAIN EXTRACTOR
# ============================================================

def extract_resume(file_path: str):

    # 1. Extract raw text
    text = extract_text(file_path)

    # 2. Split into sections
    sections = split_sections(text)

    # 3. Basic information
    name = extract_name(text)

    email = extract_email(text)

    phone = extract_phone(text)

    links = extract_links(text)

    # 4. Skills
    skills = extract_skills(text)

    # 5. Experience
    years_experience = extract_years_of_experience(
        text
    )

    # 6. Education
    education = extract_education(text)

    # 7. Projects
    projects = extract_projects(
        sections
    )

    # 8. Final structured output
    result = {

        "candidate": {

            "name": name,

            "email": email,

            "phone": phone,

            "linkedin": links["linkedin"],

            "github": links["github"],

            "portfolio": links["portfolio"]
        },

        "professional": {

            "summary": sections.get(
                "summary",
                ""
            ),

            "years_of_experience":
                years_experience,

            "skills": skills,

            "experience":
                sections.get(
                    "experience",
                    ""
                )
        },

        "education": education,

        "projects": projects,

        "certifications":
            sections.get(
                "certifications",
                ""
            ),

        "achievements":
            sections.get(
                "achievements",
                ""
            ),

        # Keep original text because
        # it can be useful later for LLM analysis
        "raw_text": text
    }

    return result


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    file_path = "Dhruv.pdf"

    result = extract_resume(
        file_path
    )

    print(
        json.dumps(
            result,
            indent=4,
            ensure_ascii=False
        )
    )