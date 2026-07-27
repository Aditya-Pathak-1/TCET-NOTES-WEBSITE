# Syllabus Dataset Knowledge Base

This folder serves as the central knowledge base for the AI Notes Generator.

**How to use:**
1. Create a folder for each Subject (e.g., `Computer Networks`).
2. Inside each subject folder, create a folder for each Module (e.g., `Module 1 - Introduction`).
3. Place your syllabus files (PDF, DOCX, TXT, MD, CSV, JSON) inside the corresponding Module folder.

**Example Structure:**
```text
dataset/
├── Computer Networks/
│   ├── Module 1 - Introduction/
│   │   └── cn_module1.pdf
│   └── Module 3 - Network Layer/
│       └── routing.docx
└── Data Structures/
    └── Module 2 - Trees/
        └── trees.pdf
```

**Notes:**
- Files are automatically indexed when the server starts or when they are changed.
- The Subject and Module names shown in the AI Notes UI are taken directly from the folder names.
- Do not place files at the root of the `dataset/` folder, they will be ignored.
