# DeepLearner
## Product Requirements Document — Version 1.0

**Product:** DeepLearner  
**Version:** 1.0  
**Status:** Development-ready PRD  
**Platform:** Responsive Web Application  
**Future Platform:** Progressive Web App (PWA)  
**Initial Scale Target:** Up to approximately 1,000 users  
**Primary Language:** English  
**Primary Audience:** Engineering/IT students and working professionals preparing for technical interviews

---

## 1. Executive Summary

DeepLearner is a visual-first learning platform designed to help students and working professionals understand difficult technical concepts by combining traditional explanations with visual learning.

Instead of presenting only text or video lessons, DeepLearner explains concepts through:

- Written explanations
- Animated diagrams
- Flowcharts
- Architecture diagrams
- Mind maps
- Timelines
- Comparison diagrams
- Execution visualizations
- Code visualizations
- Examples
- Practice questions
- Flashcards
- Memory techniques
- Revision material
- Interview questions

The core product philosophy is:

> **Understand difficult concepts by seeing how they work.**

DeepLearner is not intended to be only a notes platform, quiz platform, or AI chatbot.

It is designed around:

```text
Read → Visualize → Example → Practice → Revise
```

Artificial intelligence will assist administrators in generating draft learning material, questions, revision material, and visualization suggestions.

AI-generated content will never be automatically published in Version 1.

The workflow will be:

```text
Admin selects topic
        ↓
AI generates draft
        ↓
Admin reviews
        ↓
Admin edits if required
        ↓
Admin approves
        ↓
Content published
        ↓
Student learns
```

Students therefore consume only reviewed and approved learning content.

---

## 2. Product Vision

DeepLearner aims to become a visual learning platform where complicated technical concepts can be understood through interactive explanations rather than memorized from large amounts of text.

A student learning JavaScript Event Loop, for example, should not only read an explanation. The student should visually see:

```text
Call Stack
     ↓
Web APIs
     ↓
Callback Queue
     ↓
Event Loop
     ↓
Call Stack
```

with objects moving between components step by step.

The intended student reaction is:

> **I finally understand this because I can see what is happening.**

---

## 3. Problem Statement

Traditional technical-learning resources frequently have one or more problems:

- Explanations are heavily text based.
- Students memorize concepts instead of understanding them.
- Difficult internal processes are difficult to imagine.
- Diagrams are usually static.
- Practice and explanations often exist on separate platforms.
- Learners have difficulty identifying weak areas.
- Interview preparation is disconnected from actual learning.
- Students consume content passively instead of interacting with it.
- AI-generated content can contain inaccuracies if published without review.

DeepLearner addresses these problems by combining visual learning, practice, progress tracking, revision, and controlled AI-assisted content generation.

---

## 4. Product Goals

DeepLearner Version 1 should allow users to:

1. Learn technical concepts through structured learning paths.
2. Understand topics through visual representations.
3. Practice concepts immediately after learning.
4. Track progress and identify weak topics.
5. Revise previously learned material.
6. Prepare separately for technical interviews.
7. Use a coding playground for JavaScript and TypeScript.
8. Save notes, bookmarks, and highlights.
9. Develop consistent learning habits using streaks, XP, and badges.
10. Access trustworthy source documentation for each concept.

For administrators, DeepLearner should allow:

1. Manual content creation.
2. AI-assisted content generation.
3. Content review and approval.
4. Visualization selection.
5. Learning-path management.
6. Practice-question management.
7. Interview-question management.
8. Content-quality monitoring.
9. Aggregate student analytics.
10. Audit logging.

---

## 5. Non-Goals for Version 1

The following features are outside the first production scope:

- Live AI chatbot for students
- Student-generated AI lessons
- Teacher accounts
- Teacher dashboards
- Student discussion forums
- Social networking
- Video hosting
- Native Android application
- Native iOS application
- Full PWA functionality
- Full content-version comparison system
- Advanced diagram drag-and-drop editor
- Node.js remote execution environment
- Detailed individual student analytics in Admin Analytics
- Automated payment integration
- Real-time collaborative learning
- AI search for arbitrary topics

These can be considered in later releases.

---

## 6. Target Users

### 6.1 Engineering and IT Students

Examples:

- Computer Science students
- IT students
- Engineering students
- Bootcamp learners
- Self-taught developers

Primary needs:

- Understand difficult concepts
- Learn visually
- Practice coding concepts
- Follow structured learning paths
- Prepare for interviews

### 6.2 Working Professionals

Software professionals preparing for:

- Job interviews
- Technology transitions
- Skill upgrades
- Technical revision

Primary needs:

- Quick revision
- Interview questions
- Advanced concepts
- Scenario-based questions
- Coding practice
- System-design understanding

---

## 7. Initial Technologies

Version 1 content will focus on:

- JavaScript
- React
- Angular
- Node.js
- MongoDB
- System Design
- Docker
- CI/CD

More technologies can later be added through Admin without changing the application architecture.

---

## 8. Content Hierarchy

DeepLearner content follows:

```text
Technology
     ↓
Learning Path
     ↓
Module
     ↓
Topic
     ↓
Concept
```

Example:

```text
JavaScript
     ↓
JavaScript Fundamentals
     ↓
Functions and Scope
     ↓
Closures
     ↓
Lexical Environment
```

Each Concept can contain:

```text
Read
Visualize
Example
Practice
Revise
Source
```

---

## 9. Core Learning Experience

Every learning topic should follow:

```text
Learn
 ↓
See
 ↓
Understand
 ↓
Practice
 ↓
Evaluate
 ↓
Revise
```

Primary navigation inside a topic:

```text
[ Read ] [ Visualize ] [ Example ] [ Practice ] [ Revise ]
```

Interview preparation remains a separate module.

---

## 10. Authentication

DeepLearner supports:

### Email and Password

Users can:

- Register
- Verify email
- Login
- Logout
- Request password reset
- Reset password

### Google Authentication

Users can:

- Register using Google
- Login using Google

Google-authenticated users do not require separate email verification.

Admin accounts cannot be created through public registration.

---

## 11. Student Onboarding

New students select:

- Technologies of interest
- Experience level
- Learning objective
- Preferred difficulty
- Daily study goal

Available goals can include:

- Learn From Scratch
- Interview Preparation
- Quick Revision
- Master a Technology
- Strengthen Weak Areas

This information personalizes:

- Dashboard recommendations
- Learning paths
- Difficulty
- Suggested topics

---

## 12. Student Dashboard

The dashboard should contain:

- Continue Learning
- Recommended Next Topic
- Today's Goal
- Learning Path Progress
- Weak Topics
- Practice Performance
- Study Time
- Current Streak
- XP
- Badges
- Recently Viewed
- Bookmarked Topics

Example:

```text
JavaScript Fundamentals

██████████████░░░░░░ 70%
```

---

## 13. Learning Paths

Admins create learning paths manually.

AI may suggest improvements but does not automatically modify published learning paths.

Example:

```text
JavaScript Learning Path

Basics
 ↓
Variables
 ↓
Functions
 ↓
Scope
 ↓
Closures
 ↓
Promises
 ↓
Async/Await
 ↓
Event Loop
```

Learning paths may contain:

- Required concepts
- Optional concepts
- Difficulty
- Recommended sequence
- Completion requirement

---

## 14. Topic Completion

A topic is considered completed when the student:

1. Completes required learning sections.
2. Completes required visualization.
3. Completes required practice.
4. Achieves the configured minimum practice score.

Default minimum score:

```text
70%
```

Admins may override the score for specific topics or learning paths.

---

## 15. Practice Attempts

Students have unlimited practice attempts.

DeepLearner stores:

- First Attempt Score
- Latest Attempt Score
- Best Attempt Score
- Total Attempts

The first attempt is never overwritten.

---

## 16. Visual Learning Engine

The Visual Learning Engine is the primary differentiating feature of DeepLearner.

Supported visualization types:

- Flowchart
- Animated Flow
- Architecture Diagram
- Mind Map
- Timeline
- Comparison Diagram
- Sequence Diagram
- Tree Diagram
- Process Diagram
- Chart
- Graph
- Interactive Step-by-Step Explanation
- Memory Visualization
- Execution Visualization
- Code Visualization

---

## 17. Visualization Controls

Where appropriate:

- Play
- Pause
- Previous Step
- Next Step
- Replay
- Speed

Example:

```text
JavaScript Event Loop

[ ◀ Previous ] [ ▶ Play ] [ Next ▶ ]

Speed: 1x

Call Stack
     ↓
Web API
     ↓
Callback Queue
     ↓
Event Loop
```

---

## 18. Visualization Creation Workflow

AI can suggest the most suitable visualization type.

Example:

```text
Topic:
JavaScript Event Loop

AI Recommendation:
Execution Flow Animation
```

Admin can accept or choose another option such as:

- Flowchart
- Mind Map
- Sequence Diagram
- Architecture Diagram
- Execution Visualization
- Comparison Diagram
- Timeline

The Admin remains the final decision maker.

---

## 19. Visualization Representation

AI should generate structured visualization data rather than executable frontend code.

Example:

```json
{
  "type": "execution-flow",
  "nodes": [],
  "edges": [],
  "steps": [],
  "animations": []
}
```

The DeepLearner Visualization Renderer interprets this structure.

Benefits:

- Security
- Consistent visual style
- Easier editing
- Easier animation
- Better validation
- Provider independence

---

## 20. Code Visualizer

Code Visualizer is one of DeepLearner's flagship features.

Initial languages:

- JavaScript
- TypeScript

Example input:

```javascript
let x = 10;

function test() {
  let y = 20;
  return x + y;
}

test();
```

Possible visualization:

```text
Global Execution Context

x = 10
test = function

          ↓

Call Stack

┌──────────────┐
│ test()       │
├──────────────┤
│ global()     │
└──────────────┘

          ↓

Local Execution Context

y = 20

          ↓

return 30
```

Future Code Visualizer capabilities may include:

- Call stack visualization
- Scope visualization
- Closure visualization
- Heap visualization
- Event loop visualization
- Promise lifecycle
- Async execution
- Variable mutation
- Function execution
- Execution contexts

---

## 21. Read Mode

Read Mode contains the traditional concept explanation.

Recommended structure:

- Concept Title
- Simple Definition
- Why It Matters
- How It Works
- Important Points
- Common Mistakes

Reading content should be concise enough to understand without becoming a textbook.

---

## 22. Example Mode

Examples should include:

- Basic example
- Real-world analogy
- Code example
- Practical use case

Recommended progression:

```text
Simple → Intermediate → Real-world
```

---

## 23. Practice Mode

Version 1 supports:

- Coding questions
- Output-based questions
- Descriptive questions
- Scenario-based questions

Answers remain hidden initially.

Practice flow:

```text
Question
 ↓
Student submits attempt
 ↓
Answer unlocks
 ↓
Explanation displayed
```

Students cannot reveal the answer before submitting an attempt.

---

## 24. Practice Answer Flow

Example:

```text
Question:
Explain JavaScript Closure.

[Student Answer]

[Submit Attempt]
```

After submission:

```text
Your Answer

Official Answer

Explanation

Key Points

Related Concept
```

---

## 25. Revise Mode

Version 1 keeps Revise Mode simple.

It may contain:

- Short summary
- Key points
- Important flashcards
- Memory trick
- Important code snippet

More advanced personalized revision can be introduced later.

---

## 26. Weak Topic Detection

Default classification:

```text
Strong
80–100%

Improving
60–79%

Weak
Below 60%
```

The dashboard recommends weak topics for revision.

The thresholds remain configurable.

---

## 27. Interview Preparation Module

Interview Preparation is separate from the learning tabs.

Structure:

```text
Technology
 ↓
Topic
 ↓
Difficulty
 ↓
Question
 ↓
Answer
 ↓
Explanation
 ↓
Follow-Up Questions
```

Difficulty levels:

- Beginner
- Intermediate
- Advanced
- Interview Ready

Students can classify interview questions as:

- Know
- Need Revision
- Important

---

## 28. Interview Answers

Unlike Practice Mode, interview answers can use:

```text
[Show Answer]
```

Students do not need to submit an answer first.

---

## 29. Coding Playground

Version 1 supports:

- JavaScript
- TypeScript

Students can:

- Write code
- Edit code
- Run supported code
- View output
- Reset editor
- Load example code

Secure browser-based execution is preferred.

Node.js server execution is outside Version 1.

---

## 30. Notes

Students can create private notes attached to concepts.

Example:

```text
My Note

“Closure = function + remembered lexical environment.”
```

Notes are visible only to the student.

---

## 31. Highlights

Students can highlight important content.

Saved highlights should be retrievable during revision.

---

## 32. Bookmarks

Students may bookmark:

- Technologies
- Topics
- Concepts
- Interview questions

---

## 33. Search

Version 1 search supports:

- Technology
- Topic
- Concept
- Interview Question

AI semantic search is not required in Version 1.

---

## 34. Gamification

Version 1 includes:

### XP

Students gain XP for meaningful learning activities.

### Daily Streak

Tracks consecutive learning days.

### Badges

Examples:

- First Topic Completed
- 7-Day Streak
- JavaScript Beginner Completed
- 100 Practice Questions
- First Perfect Score

Leaderboard and certificates are future features.

---

## 35. Notifications

Version 1 supports in-app notifications.

Examples:

- New lesson published
- Badge earned
- Learning path completed
- Streak reminder
- New interview questions

---

## 36. Email Notifications

Core authentication emails:

- Welcome email
- Verify email
- Forgot password
- Reset-password confirmation

Additional marketing emails are outside MVP.

---

## 37. Source Links

Every published technical concept must contain at least one source.

Source preference:

1. Official documentation
2. Official specifications
3. Vendor documentation
4. Trusted technical source

Source links appear at the bottom of the concept.

Admin approval should fail if required source information is missing.

---

## 38. Report Incorrect Content

Students can report:

- Incorrect information
- Outdated information
- Broken source links
- Visualization issues
- Incorrect answers
- Other content problems

Reports appear inside the Admin portal.

---

## 39. Public Learning Pages

Selected lessons may be publicly accessible without login.

Example:

```text
deeplearner.com/javascript/event-loop
```

Public pages should be designed for future search-engine indexing.

Private learning functionality still requires login.

---

## 40. Landing Page

DeepLearner includes a public landing page.

Sections:

- Hero
- How DeepLearner Works
- Visual Learning Demo
- Technologies
- Features
- Learning Experience
- Free vs Premium
- Login
- Register

Design direction:

> **Professional educational platform + modern developer-tool aesthetic.**

---

## 41. User Roles

Version 1 supports:

```text
STUDENT
ADMIN
```

No Teacher role.

---

## 42. Admin Dashboard

Main Admin navigation:

- Overview
- Students
- Content
- AI Drafts
- Approval Queue
- Learning Paths
- Interview Questions
- Visualizations
- Analytics
- Content Performance
- Subscriptions
- Reported Content
- Audit Logs
- System Settings

Detailed individual student analytics are excluded from Version 1 Admin Analytics.

---

## 43. Admin Student Management

Admin can:

- View students
- Search students
- View account status
- Disable account
- Enable account
- Suspend account
- Unsuspend account
- View plan
- Change plan if necessary
- View aggregate usage statistics

Admin cannot directly read or reset user passwords.

---

## 44. Content Creation

Admins may create content in two ways.

### Manual

```text
Admin
 ↓
Create Concept
 ↓
Write Content
 ↓
Add Visualization
 ↓
Add Practice
 ↓
Add Source
 ↓
Approve
 ↓
Publish
```

### AI Assisted

```text
Admin
 ↓
Enter Topic
 ↓
Generate with AI
 ↓
Review
 ↓
Edit
 ↓
Approve
 ↓
Publish
```

AI is optional.

Admins must always be able to create content without AI.

---

## 45. AI Generation Options

Admin can request:

- Read Explanation
- Visualization Suggestion
- Examples
- Practice Questions
- Revision Material
- Flashcards
- Memory Trick
- Interview Questions

Admin may choose one or multiple options.

---

## 46. Content Workflow

Supported states:

```text
DRAFT
AI_GENERATED
IN_REVIEW
CHANGES_REQUIRED
APPROVED
PUBLISHED
ARCHIVED
```

Only `PUBLISHED` content appears to students.

---

## 47. AI Approval Requirement

AI-generated content must never automatically transition to Published.

Required workflow:

```text
AI_GENERATED
     ↓
IN_REVIEW
     ↓
APPROVED
     ↓
PUBLISHED
```

An Admin must perform the approval.

---

## 48. Content Versioning

Full version-control functionality is outside MVP.

Version 1 maintains:

- Audit history
- Updated timestamp
- Updated-by Admin
- Last published content snapshot

The system does not require:

- Version comparison
- Multiple rollback versions
- Git-style history

These may be introduced later.

---

## 49. Content Quality Analytics

DeepLearner should identify potentially weak learning content.

Example:

```text
JavaScript Closures

Views:                856
Topic Completion:     61%
Average Score:        43%
Repeated Failures:    38%
Revisits:             331
Reports:                9

⚠ Content Needs Review
```

The platform may flag a concept when:

- Average scores are unusually low
- Repeat attempts are high
- Abandonment is high
- Revisit frequency is unusually high
- Content reports increase

Admin makes the final decision.

---

## 50. Aggregate Admin Analytics

Admin analytics can include:

- Total registered users
- Active users
- Free users
- Premium users
- Learning sessions
- Total learning time
- Topics started
- Topics completed
- Most studied technologies
- Most studied topics
- Least studied topics
- Average practice scores
- Weak-topic trends
- Learning-path completion
- Streak distribution
- Content reports
- Content quality alerts

Detailed individual student analytics are not required.

---

## 51. Content Audit Trail

Admin actions should be recorded.

Examples:

```text
Admin A created topic
Admin A generated AI draft
Admin A edited draft
Admin B approved concept
Admin A published concept
Admin A archived concept
```

Audit information should include:

- Actor
- Action
- Resource
- Timestamp
- Optional metadata

---

## 52. Content Deletion

Published learning content should use soft deletion or archival rather than permanent deletion.

Preferred behavior:

```text
Published
 ↓
Archived
```

rather than physically removing referenced data.

---

## 53. Free and Premium Model

DeepLearner supports plans from the beginning even though payment integration is deferred.

Preferred architecture:

```text
Plan
 ↓
Entitlements
 ↓
Features
```

Possible entitlements:

- visual_learning
- advanced_practice
- code_visualizer
- interview_module
- flashcards
- advanced_revision
- advanced_analytics

---

## 54. Development Access

During development:

> **All users receive premium capabilities.**

The entitlement architecture still exists.

The actual stored default plan remains `FREE`, while development configuration overrides access.

---

## 55. Intended Future Plan Structure

### Free

- Selected lessons
- Read mode
- Examples
- Limited practice
- Selected visualizations
- Basic progress

### Premium

- All lessons
- Advanced visualizations
- Full practice
- Code Visualizer
- Interview preparation
- Flashcards
- Advanced revision
- Expanded analytics

Payment processing is outside MVP.

---

## 56. Artificial Intelligence Strategy

AI primarily assists Admin in Version 1.

AI should not be the system of record.

AI-generated output becomes normal DeepLearner content after approval.

Flow:

```text
AI
 ↓
Draft
 ↓
MongoDB
 ↓
Admin Review
 ↓
Published Content
 ↓
Student
```

Students do not trigger AI API requests when viewing normal published lessons.

This controls AI cost.

---

## 57. AI Provider Abstraction

DeepLearner should avoid coupling business logic directly to one AI provider.

Conceptual interface:

```typescript
interface AIProvider {
  generateLesson(): Promise<unknown>;
  generatePracticeQuestions(): Promise<unknown>;
  generateFlashcards(): Promise<unknown>;
  suggestVisualization(): Promise<unknown>;
  generateInterviewQuestions(): Promise<unknown>;
}
```

Architecture:

```text
DeepLearner AI Service
        ↓
AI Provider Adapter
        ↓
AI Provider
```

This allows future provider replacement without rewriting the learning platform.

---

## 58. AI Security

AI API keys must never reach the browser.

Correct architecture:

```text
React / Next.js
 ↓
DeepLearner API
 ↓
AI Service
 ↓
AI Provider
```

Never:

```text
Browser
 ↓
AI Provider
```

Secrets are backend-only.

---

## 59. Secret Management

During local development:

```text
.env
```

can contain secrets.

`.env` must never be committed.

Repository contains:

```text
.env.example
```

without real values.

Example:

```env
MONGODB_URI=
AI_API_KEY=
JWT_SECRET=
GOOGLE_CLIENT_ID=
AWS_BUCKET=
```

Production secrets should eventually use hosting-platform secret management or AWS Secrets Manager.

---

## 60. AI Abuse Protection

AI endpoints must include:

- Authentication
- Admin authorization
- Rate limiting
- Input validation
- AI usage quota
- Maximum request size
- Maximum generated output
- Model restriction
- Audit logging
- Spending monitoring

Students do not have direct access to AI-generation APIs in Version 1.

---

## 61. Development AI Controls

Use separate development and production AI projects/keys.

Recommended:

```text
DeepLearner DEV
      ↓
DEV AI KEY

DeepLearner PROD
      ↓
PROD AI KEY
```

Development should use:

- Low spending limit
- Usage notifications
- Restricted permissions
- Regular key rotation

---

## 62. AI Usage Logging

Store:

- Admin ID
- Feature
- Provider
- Model
- Input tokens
- Output tokens
- Estimated usage
- Timestamp
- Status

Do not store secret keys in logs.

---

## 63. API Security

Backend APIs should include:

- HTTPS
- Authentication
- Role-based authorization
- Input validation
- Rate limiting
- Request-size limits
- Security headers
- Appropriate CORS configuration
- Secure token/cookie practices
- Logging
- Error sanitization

Sensitive error details must not be returned to clients.

---

## 64. Authentication Security

For email authentication:

- Passwords are hashed using Argon2id.
- Passwords are never stored in plaintext.
- Reset tokens expire.
- Verification tokens expire.
- Brute-force protection exists.
- Email is normalized to lowercase.
- Email is globally unique.

Authentication decisions:

- Access token lifetime: 15 minutes.
- Refresh token lifetime: 30 days.
- Refresh-token rotation enabled.
- Multiple concurrent device sessions allowed.
- Logout current device supported.
- Logout all devices supported.
- Email verification token expires in 15 minutes.
- Password reset token expires in 30 minutes.
- No email-change feature in V1.
- Google verified email may link to an existing account.
- Students cannot create Admin accounts.

---

## 65. Bot Protection

High-risk endpoints should have stronger rate controls:

```text
/login
/register
/forgot-password
/reset-password
/admin/ai/*
```

Bot/challenge protection may be added where abnormal behavior is detected.

---

## 66. Core Technology Architecture

DeepLearner uses a modular-monolith backend.

Final application topology:

```text
Student/Public App
Next.js + TypeScript
deeplearner.com

        │ REST

Admin App
React + TypeScript + Vite
admin.deeplearner.com

        │ REST

Shared Backend
Node.js + Express + TypeScript
api.deeplearner.com
```

The backend remains one modular monolith.

---

## 67. Recommended Technology Stack

### Student/Public Application

- Next.js
- TypeScript

### Admin Application

- React
- TypeScript
- Vite

### Backend

- Node.js
- Express
- TypeScript

### API

- REST
- Versioned under `/api/v1`

### Database

- MongoDB Atlas

### ODM

- Mongoose

### Validation

- Zod

### Authentication

- Custom DeepLearner authentication
- Google OAuth/OIDC via supported library
- Argon2id
- Access token + secure HTTP-only refresh token

### Storage

- AWS S3

### Visualization

- React Flow
- SVG
- Framer Motion
- D3 only where required

### Code Editor

- Monaco Editor

### Repository

- One GitHub monorepo
- npm workspaces

---

## 68. Backend Modular Monolith

Suggested backend modules:

```text
auth/
users/
admin/
technologies/
learning-paths/
modules/
topics/
concepts/
visualizations/
practice/
interview/
progress/
notes/
bookmarks/
highlights/
gamification/
notifications/
search/
analytics/
ai/
media/
reports/
subscriptions/
audit/
```

One Node application, one backend deployment, one MongoDB database initially.

---

## 69. Database

Recommended:

```text
MongoDB Atlas
Managed MongoDB Cluster
```

Development can begin on an available free/shared cluster.

Detailed database design is maintained separately in the DeepLearner Database Design document.

---

## 70. Media Storage

Use AWS S3 for:

- Images
- SVG
- GIF

No video hosting in Version 1.

MongoDB stores metadata only.

Example:

```json
{
  "assetType": "svg",
  "storageKey": "javascript/event-loop/event-loop.svg",
  "conceptId": "..."
}
```

---

## 71. S3 Security

Recommended upload flow:

```text
Admin Browser
     ↓
DeepLearner Backend
     ↓
Presigned Upload URL
     ↓
AWS S3
```

Permanent AWS credentials must never be exposed to the frontend.

S3 should be private.

CloudFront may be introduced later.

---

## 72. Search

Initial search uses MongoDB-based querying/indexing.

Supported search:

- Technology
- Topic
- Concept
- Interview question

No Elasticsearch required initially.

Semantic/vector search can be introduced later.

---

## 73. Analytics Events

Important events:

- user_registered
- user_logged_in
- learning_path_started
- concept_started
- read_completed
- visualization_started
- visualization_completed
- example_viewed
- practice_started
- practice_submitted
- answer_revealed
- concept_completed
- concept_revisited
- bookmark_added
- highlight_added
- note_created
- interview_question_viewed
- badge_earned
- content_reported

These power future analytics.

---

## 74. Accessibility

Visual learning must never become visual-only learning.

Every visualization should provide:

- Text explanation
- Readable labels
- Keyboard navigation where practical
- Appropriate contrast
- Accessible controls
- Reduced-motion option
- Alternative descriptions where required

Users who disable animation should still be able to understand the concept.

---

## 75. Responsive Design

Version 1 supports:

- Desktop
- Laptop
- Tablet
- Mobile browser

The application is responsive from the beginning.

---

## 76. Future PWA

DeepLearner can later become a PWA.

Architecture should not block:

- Installable web application
- Offline shell
- Cached learning content
- Push notifications
- Background synchronization

PWA functionality is not required for initial release.

---

## 77. Performance Requirements

Recommended targets:

- Public pages should load quickly on normal connections.
- Frequently accessed static assets should be cacheable.
- Large visualization libraries should use lazy loading.
- Course modules should use code splitting where appropriate.
- Images should be optimized.
- SVG should be preferred for diagrams where practical.
- API pagination should be used for large datasets.

---

## 78. Reliability Requirements

The application should:

- Gracefully handle API failures
- Preserve student attempts
- Prevent duplicate practice submissions where possible
- Prevent partially published content
- Prevent broken approval states
- Provide meaningful user-facing errors

---

## 79. Scalability

Version 1 target:

```text
Approximately 1,000 users
```

The modular-monolith architecture is sufficient.

Scale vertically first.

Introduce microservices only when clear technical or organizational requirements justify them.

---

## 80. Development Deployment

Development should prioritize:

- Low cost
- Easy deployment
- Reasonable scalability
- Easy maintenance

Recommended development topology:

```text
Student Next.js App
      ↓
Vercel or equivalent

Admin React App
      ↓
Vercel or equivalent

Node API
      ↓
Development-friendly Node host

MongoDB
      ↓
MongoDB Atlas

Assets
      ↓
AWS S3

AI
      ↓
External AI Provider
```

---

## 81. Production Evolution

Later production architecture may become:

```text
Browser
   ↓
CDN / Edge Security
   ↓
Student/Admin Apps
   ↓
Node.js REST API
   ↓
MongoDB Atlas
   ↓
AWS S3
   ↓
AI Provider
```

Future components may include:

- CloudFront
- WAF
- Centralized logging
- Error monitoring
- Metrics
- Secrets Manager
- Backup strategy

---

## 82. Content Quality Requirements

Before publishing a concept, Admin should verify:

- Title exists
- Technology exists
- Learning-path placement exists
- Read content exists
- Required visualization exists
- Examples exist
- Required practice exists
- Source link exists
- Difficulty configured
- Completion requirement configured

AI content must receive human review.

---

## 83. Public Content SEO

Public lesson pages should support:

- Clean URLs
- Page titles
- Meta descriptions
- Semantic HTML
- Search-engine-friendly content
- Structured internal navigation

Examples:

```text
/javascript/closures
/react/useeffect
/system-design/load-balancer
```

---

## 84. Content Reporting Workflow

```text
Student
 ↓
Report Content
 ↓
Admin Queue
 ↓
Admin Reviews
 ↓
Fix / Reject Report
 ↓
Close Report
```

---

## 85. Premium Architecture

Access checks should use centralized entitlements.

Conceptual API:

```typescript
canUseFeature(user, "code_visualizer");
```

Avoid hardcoding plan checks throughout UI components.

---

## 86. MVP Feature Scope

The initial MVP includes:

- Authentication
- Google Login
- Student Onboarding
- Student Dashboard
- Technology Catalog
- Learning Paths
- Modules
- Topics
- Concepts
- Read Mode
- Visualize Mode
- Example Mode
- Practice Mode
- Revise Mode
- Visual Learning Engine
- Basic Code Visualizer
- JavaScript/TypeScript Playground
- Practice Attempts
- Weak Topic Detection
- Progress Tracking
- Bookmarks
- Notes
- Highlights
- Interview Preparation
- XP
- Streak
- Badges
- Search
- In-App Notifications
- Public Landing Page
- Selected Public Lessons
- Admin Dashboard
- Admin Content Management
- AI Draft Generation
- Approval Workflow
- Learning Path Management
- Interview Content Management
- Visualization Selection
- Aggregate Analytics
- Content Quality Analytics
- Reported Content
- Audit Logs
- AWS S3 Asset Storage
- MongoDB Atlas
- AI Security Controls
- Entitlement Architecture

---

## 87. Phase 2

Potential Phase 2 features:

- Advanced Visual Editor
- More Code Visualizations
- Improved Revision Engine
- Personalized Revision
- Content Recommendations
- Leaderboard
- Certificates
- Advanced Search
- PWA
- Offline Content
- Push Notifications
- More Technologies

---

## 88. Phase 3

Possible Phase 3 features:

- Student AI Tutor
- AI Topic Search
- Generate Topic On Demand
- AI Question Explanations
- Personalized AI Learning Path
- Advanced Code Execution
- More Languages
- Teacher Accounts
- Institution Accounts
- Subscription Payments
- Mobile Applications

---

## 89. Future Student AI Tutor

Not Version 1.

Future flow:

```text
Student:

“I still don't understand closures.”

AI:

Alternative explanation
 ↓
Different analogy
 ↓
Different visual
 ↓
New example
 ↓
Practice question
```

This functionality must use strong cost, moderation, and abuse controls.

---

## 90. Success Metrics

### Engagement

- Active students
- Learning sessions
- Average session duration
- Concepts started
- Concepts completed

### Learning

- Practice score improvement
- Weak → Improving transitions
- Improving → Strong transitions
- Revisit rate
- First score versus best score

### Visual Learning

- Visualization completion rate
- Visualization replay rate
- Visual versus Read engagement
- Drop-off points

### Retention

- 7-day retention
- Learning streak continuation
- Returning learners

### Content Quality

- Reported-content rate
- Average practice performance
- Repeated failure rate
- Concepts flagged for review

---

## 91. Key Product KPI

A future primary product metric could be:

> **Percentage of weak concepts that move to Improving or Strong after revision.**

This reflects DeepLearner's educational value better than page views alone.

---

## 92. Major Risks and Mitigations

### AI Hallucination

**Risk:** AI generates incorrect learning material.

**Mitigation:**

- Mandatory Admin review
- Mandatory source
- Approval workflow
- Student reporting

### AI API Cost Abuse

**Risk:** Bots or compromised accounts consume AI credits.

**Mitigation:**

- Admin-only AI
- Rate limits
- Daily quotas
- Budget limits
- Usage alerts
- Separate DEV key
- Backend-only secrets

### API Key Leakage

**Mitigation:**

- Never expose keys to frontend
- Use environment secrets
- Never commit `.env`
- Rotate keys
- Limit permissions
- Monitor usage

### Poor Visualizations

**Risk:** Visualizations look attractive but confuse students.

**Mitigation:**

- Admin selection
- Admin preview
- Student performance analytics
- Content quality alerts
- Student reports

### Feature Overload

**Risk:** Too many features delay launch.

**Mitigation:** Prioritize:

```text
Learning
Visualization
Practice
Progress
Admin Content
```

before advanced social or AI features.

### Incorrect Progress Measurements

**Mitigation:** Store:

- First Attempt
- Best Attempt
- Attempts
- Completion
- Section activity

instead of relying on a single score.

---

## 93. Acceptance Criteria — Authentication

Authentication is complete when:

- Student can register using email/password.
- Student can verify email.
- Student can login.
- Student can reset password.
- Student can login using Google.
- Google users do not require separate email verification.
- Admin routes reject Student users.
- Admin cannot be created through public registration.
- Email change is not available in V1.

---

## 94. Acceptance Criteria — Learning

Learning is functional when:

- Student can browse technology.
- Student can select learning path.
- Student can open topic.
- Student can access Read.
- Student can access Visualize.
- Student can access Example.
- Student can complete Practice.
- Student can access Revise.
- Student progress is stored.
- Topic completion respects minimum score.

---

## 95. Acceptance Criteria — Practice

Practice is complete when:

- Student can submit supported question types.
- Answers remain hidden before submission.
- Official answer unlocks after submission.
- First score is preserved.
- Best score is preserved.
- Student may retry questions.
- Progress updates correctly.

---

## 96. Acceptance Criteria — Visual Learning

Visualization feature is complete when:

- Admin can select visualization type.
- Admin can preview visualization.
- Visualization is attached to concept.
- Student can view it.
- Supported animations provide appropriate controls.
- Reduced-motion fallback exists.
- Text explanation remains available.

---

## 97. Acceptance Criteria — AI Content

AI generation is complete when:

- Only Admin can request generation.
- AI API key remains backend-only.
- Admin can choose content types to generate.
- Generated content enters `AI_GENERATED` state.
- Admin can edit content.
- Admin can approve content.
- Content cannot auto-publish.
- Required source validation occurs before publishing.

---

## 98. Acceptance Criteria — Admin Analytics

Admin analytics are complete when Admin can see:

- Aggregate users
- Learning activity
- Popular technologies
- Popular topics
- Practice performance
- Weak-topic trends
- Content-quality warnings
- Content reports

Detailed individual learning analytics are not required.

---

## 99. Acceptance Criteria — Security

Minimum security criteria:

- No secret exists in frontend bundle.
- `.env` is excluded from repository.
- AI endpoints require Admin.
- Rate limiting exists.
- Authentication endpoints are protected.
- Input validation exists.
- Passwords are securely hashed.
- Sensitive information is excluded from logs.
- AWS credentials are not exposed to browser.
- S3 uploads use secure server-controlled access.

---

## 100. Definition of MVP Success

DeepLearner MVP is considered successful when a new student can:

```text
Register
 ↓
Choose JavaScript
 ↓
Start Learning Path
 ↓
Open Event Loop
 ↓
Read explanation
 ↓
Watch visualization
 ↓
View example
 ↓
Complete practice
 ↓
Reach passing score
 ↓
Complete topic
 ↓
Earn XP
 ↓
See updated progress
```

and an Admin can:

```text
Create Event Loop topic
 ↓
Ask AI to generate draft
 ↓
Review content
 ↓
Choose visualization
 ↓
Add official source
 ↓
Approve
 ↓
Publish
 ↓
Monitor student performance
```

without direct database modification.

---

## 101. Product Identity

**Name:** DeepLearner

Recommended positioning:

> **DeepLearner — Understand it. Visualize it. Practice it. Remember it.**

Alternative tagline:

> **See how concepts work.**

Longer positioning statement:

> DeepLearner is a visual-first technical learning platform that transforms difficult programming and software-engineering concepts into interactive explanations, animations, diagrams, examples, practice, and revision experiences.

---

## 102. Final Product Principles

### Understanding before memorization

The goal is comprehension.

### Visual when visual adds value

Do not create animation only for decoration.

### Active learning

Students should practice rather than only consume.

### Human-reviewed AI

AI assists content creation; humans control publishing.

### Trusted references

Students should be able to verify important concepts.

### Measurable learning

Track whether understanding improves.

### Simple first

Do not build complex infrastructure before it is required.

---

## 103. Locked Version 1 Decisions

```text
Product name:
DeepLearner

Target:
Engineering/IT students
Working professionals

Initial technologies:
JavaScript
React
Angular
Node.js
MongoDB
System Design
Docker
CI/CD

Roles:
STUDENT
ADMIN

Platform:
Responsive Web

Future:
PWA

Student/Public:
Next.js + TypeScript

Admin:
React + TypeScript + Vite

Backend:
Node.js + Express + TypeScript

API:
REST /api/v1

Architecture:
Modular Monolith Backend
One GitHub monorepo
npm workspaces

Database:
MongoDB Atlas
Mongoose

Validation:
Zod

Storage:
AWS S3

Authentication:
Custom email/password
Google OAuth/OIDC
Argon2id
15-minute access token
30-day refresh token
Secure HttpOnly refresh cookie

AI:
Admin-side generation only
Human approval mandatory

Visualization:
Core product feature

Code Visualizer:
Included

Practice:
Answers unlock after attempt

Interview:
Separate feature
Show Answer supported

Gamification:
XP
Streak
Badges

Media:
Images
SVG
GIF

Videos:
Not supported

Teacher:
Not supported

Community:
Not supported

Source:
Required

Student AI Tutor:
Future

Payments:
Future

Development:
All users may access Premium functionality

Stored default plan:
FREE

Scale:
Approximately 1,000 initial users
```

---

## 104. Recommended Supporting Documents

This PRD acts as the parent document for:

- DeepLearner System Architecture
- Database Design
- API Design
- Authentication Design
- Frontend Architecture
- Admin Portal Specification
- Visual Learning Engine Design
- Code Visualizer Technical Design
- AI Integration Design
- Security Architecture
- UI/UX Wireframes
- Analytics/Event Specification
- MVP Development Backlog
- Testing Strategy
- Deployment Architecture

These documents should derive their requirements from this PRD rather than redefining product behavior.

---

## 105. Final Product Flow

```text
                    DEEPLEARNER

                         │
              ┌──────────┴──────────┐
              │                     │
           STUDENT                ADMIN
              │                     │
              ▼                     ▼

       Choose Technology       Create Content
              │                     │
       Learning Path             Manual / AI
              │                     │
           Module                 Review
              │                     │
            Topic                  Edit
              │                     │
           Concept                Approve
              │                     │
     ┌────────┼─────────┐          Publish
     │        │         │             │
    Read   Visualize  Example          │
     │        │         │             │
     └────────┼─────────┘             │
              │                       │
           Practice ◄─────────────────┘
              │
           Score
              │
        Weak / Improving
            / Strong
              │
           Revise
              │
       Complete Topic
              │
        Update Progress
              │
        XP / Streak / Badge
              │
      Recommended Next Topic
```

---

## 106. PRD Status

**Approved product direction:** Ready for technical design and implementation planning.
