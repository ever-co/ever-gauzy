# Feature Specification: Learning management

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `learning-management`
**Branch**: `feat/learning-management`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_LEARNING` (default off)

---

## 1. Overview

The platform gains a learning area. Authors build **courses** of **chapters** and **lessons** made of content blocks
(text, video, audio, documents, embedded quizzes, assignments and exercises), reviewers publish them to a catalogue,
and **learners** enrol, progress lesson by lesson and earn **certificates** and **badges**. A learner is any person
the platform knows: an employee, a contact person of a customer, or a portal user who signed up, so the same content
serves staff training and customer academies. **Cohorts** run courses on dates with seats, a timetable, live classes,
announcements and feedback; **learning paths** bundle courses in order. **Quizzes** draw from a question bank;
**assignments** are graded by instructors. Courses, cohorts and certificates can be sold as catalogue items through
orders with prices, coupons, invoices and online payment, the purchase granting the right of access. For HR,
**training programmes** and **training sessions** record classroom and external trainings with invitations, results
and feedback, and completed learning appears on the employee's skills. Clients: the Gauzy web app (authors,
instructors, learners; learner pages also at phone width and installable on phones), public catalogue feeds rendered
by an Ever Works site, a certificate check page, MCP tools and SDKs.

**Advanced capabilities.** An assistant drafts quizzes, lesson summaries and glossaries from a course's own content,
and nothing reaches learners before an instructor approves it. Learning paths are assigned automatically from
onboarding, from review development areas and from skill gaps against a position, with due dates and renewal of
compliance certificates before they expire. A skills graph links positions, courses and people: completing a course
proposes proficiency updates and every gap gets course suggestions. Certificates carry a verification code and a
public check page that shows validity and revocation. Courses keep a draft and a published version, so authors edit
without disturbing learners. The question bank has more question kinds, tags and difficulty draws, assignments have
rubrics, cohorts have waiting lists and in-person attendance, and agents can tutor learners from course content.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an author, **when** they create "Secure coding basics" with a cover, intro video, three chapters and nine
  lessons by dragging items in the outline, **then** every change autosaves, leaving with unsaved text asks first,
  and submitting for review puts the course in the reviewers' queue with a warning that one quiz has no question.
- **Given** a reviewer, **when** they publish the course, **then** it appears in the catalogue for the chosen
  audience; later edits stay in a draft version until published again, and learners keep their completed lessons.
- **Given** an employee learner, **when** they enrol and open the first lesson, **then** they watch the video (skipping
  forward is blocked by the course rule), take the embedded quiz, and the lesson completes once the rules are met; the
  outline updates live and "continue" brings them back to the next lesson.
- **Given** a course in sequential mode, **when** the learner opens lesson 4 before finishing lesson 3, **then** it is
  locked with the reason; turning the mode on later never removes completed lessons.
- **Given** a learner who finished every lesson, **when** the course has certificates on, **then** a certificate with
  a verification code is issued and emailed; **when** anyone opens the check page with the code, **then** they see
  learner, course, dates and "valid".
- **Given** an instructor, **when** they create a cohort of two courses with 30 seats, dates, a timetable of lessons
  and two live classes, **then** enrolled learners get invitations with meeting links; attendance comes from the
  meeting's participants; the 31st learner joins the waiting list and moves up when a seat frees.
- **Given** a paid cohort, **when** a portal visitor buys it with a coupon, **then** tax is computed, they pay online,
  an invoice is issued, and access opens only once the payment is confirmed.
- **Given** a quiz with a question bank draw of 10 questions tagged "networking", **when** the learner submits it,
  **then** they see score, percentage and pass, with answers shown if the quiz allows; open answers wait for an
  instructor, and a later pass completes the lesson.
- **Given** an assignment with a rubric, **when** the learner uploads a PDF, **then** the instructor grades each rubric
  criterion, the learner is notified and the lesson completes on a pass.
- **Given** HR, **when** they schedule a first-aid workshop with an outside provider for 12 mandatory attendees, **then**
  invitations go out; after the session HR records hours and grades, attendees are asked for feedback, and the
  training shows on each employee's skills.
- **Given** a review whose development area is "Public speaking", **when** the manager assigns the matching path, **then**
  the employee is enrolled with a due date, reminded before it, and the review shows the path's progress.
- **Given** an instructor, **when** they ask the assistant for a quiz on chapter 2, **then** draft questions with the
  passages they come from appear for approval; nothing is visible to learners until approved.

### 2.2 Edge cases & failures

- **Given** a user without the permission, **when** they call a learning route, **then** `403`; with the feature off
  every route answers `404`, menus and public pages are hidden; a concurrent edit gets `409`.
- **Given** a cohort with no seat left, **when** two learners enrol at the same moment, **then** one gets the seat and
  the other joins the waiting list; nobody is enrolled twice.
- **Given** an unpublished course, **when** a learner tries to enrol, **then** it is refused; a paid course without
  confirmed payment never opens its lessons; a refund revokes access per the course's refund rule.
- **Given** a quiz with 3 attempts, **when** a learner sends a fourth from two tabs at once, **then** it is refused once
  the count is reached, and only one attempt is counted per submission.
- **Given** a proctored quiz, **when** the learner leaves the tab a third time, **then** the attempt is submitted with the
  reason recorded and the instructor sees the log.
- **Given** an uploaded package whose manifest is invalid or that contains executable files outside the allowed list,
  **when** it is uploaded, **then** it is refused with the reason and nothing is stored.
- **Given** a course archive from another organization, **when** imported, **then** unsafe paths are refused, assets are
  copied, a question name already used is renamed rather than merged, and source authors are not kept.
- **Given** an evaluator slot booked by another learner a moment earlier, **when** a learner confirms it, **then** they
  are offered the remaining slots; past slots and slots after the cohort's evaluation end are never offered.
- **Given** no outgoing email configured, **when** an upcoming course launches, **then** it launches, interested
  people stay marked unsent and are emailed once mail works.
- **Given** a revoked certificate, **when** its check page is opened, **then** it shows "revoked" with the date.

## 3. Functional Requirements

### 3.1 Catalogue and authoring

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `LEARNING_COURSE_AUTHOR` can create a course: title (address name derived and unique per organization), summary, rich description, cover image (or a generated card), intro video, tags, category, language, level, estimated duration and one or more instructors (duplicates refused). |
| **FR-2** | The system MUST keep a course draft, in review, published or archived, with "coming soon" and "featured" flags; a user with `LEARNING_COURSE_REVIEW` lists courses in review and publishes or returns them with a note. |
| **FR-3** | The system MUST warn on submit and on publish when a quiz in the course has no valid question, and refuse publishing a course without at least one lesson. |
| **FR-4** | The system MUST keep a draft version beside the published one: authors edit the draft, publishing makes it current, and learners keep completed lessons matched by lesson identity; quizzes, questions, assignments and their placements are part of the version, so learners see their published form until the course is republished. *(advanced)* |
| **FR-5** | The system MUST let visitors register interest in a coming-soon course and email them once when it is published; people not reached because mail failed stay marked and are retried. |
| **FR-6** | A user with `LEARNING_COURSE_AUTHOR` can add chapters to a course and lessons to chapters, reorder both by dragging, move lessons between chapters, and delete them (references from progress, quizzes and timetables cleaned); authors cannot move items out of a course they cannot edit. |
| **FR-7** | The system MUST offer a one-screen outline editor with a create-outline wizard, empty-state help, autosave and a warning before leaving with unsaved changes. |
| **FR-8** | A user with `LEARNING_COURSE_AUTHOR` can mark lessons as free preview, open to visitors who are not enrolled. |
| **FR-9** | The system MUST show related courses, browsing by category, and featured and popular courses on the catalogue home; a user with `LEARNING_COURSE_MANAGE` maintains categories. |
| **FR-10** | The system MUST let a course's visibility be organization members, signed-in portal learners or everyone, and publish the public catalogue and course details through a public feed that an Ever Works site renders as pages indexable by search engines (with the Ever Works integration on, publishing pushes the changes to the linked site). |
| **FR-11** | A user with `LEARNING_COURSE_AUTHOR` can add instructor-only notes and content to a lesson and mark assessments as instructor-only; learners never receive them. |

### 3.2 Lesson content and completion

| ID | Requirement |
| --- | --- |
| **FR-12** | The system MUST compose lessons from blocks: headings, paragraphs, lists, tables, formatted text, images, files, video, audio, PDF, embeds from an allow-list, quizzes, assignments, exercises and live class references; content is sanitised when saved. |
| **FR-13** | The system MUST play video from uploaded files (stored in `drive`) and links of allowed hosts, record watched ranges per learner, and apply per course the options "no skipping forward" and "lesson counts only after the video is watched". |
| **FR-14** | A user with `LEARNING_COURSE_AUTHOR` can place quiz questions at points of a video; the video pauses until answered. |
| **FR-15** | The system MUST show text, PDF, image, document and audio content inline and serve files only to people allowed to see the lesson. |
| **FR-16** | A user with `LEARNING_COURSE_AUTHOR` can upload a packaged e-learning module in the common interoperable package format as a chapter; the package is checked and unpacked, its launch file detected, it plays in the app and its completion, score and resume state are stored; deleting the chapter removes the files. |
| **FR-17** | A learner can write notes and colour highlights on a lesson, private to them. |
| **FR-18** | The system MUST offer discussions on each lesson and on each course with replies and mentions (mentions notify), readable only by enrolled learners and staff of the course; a user with `LEARNING_INSTRUCT` can hide a post with a reason. |
| **FR-19** | The system MUST support a sequential mode per course: a lesson opens when it is at or before the first incomplete one or already done; completing a locked lesson is refused; switching the mode on never removes completed work. |
| **FR-20** | A user with `LEARNING_SETTINGS_EDIT` can set completion rules per organization and override them per course: video watched; quiz attempted or passed; assignment attempted or passed; exercise attempted or passed; minimum time on a lesson (default 30 s); each rule off, attempted or passed. |

### 3.3 Assessments

| ID | Requirement |
| --- | --- |
| **FR-21** | A user with `LEARNING_COURSE_AUTHOR` can keep a question bank per organization with author, search and filters: single and multiple choice (option rows with explanations), short answer (accepted answers), numeric with tolerance, ordering, matching, fill in the blanks and open answer graded by hand; marks per question (default 1), tags and difficulty. *(advanced)* |
| **FR-22** | A user with `LEARNING_COURSE_AUTHOR` can build a quiz from bank questions (duplicates refused) or from draws (n questions by tag and difficulty), with marks per question, total computed, pass percentage, duration and maximum attempts. |
| **FR-23** | The system MUST offer quiz options: shuffle questions and options, show answers after submission, show attempt history, an open window (start, end), and negative marking with marks deducted per wrong answer, the score never below zero. |
| **FR-24** | A user with `LEARNING_COURSE_AUTHOR` can switch on monitoring for a quiz: tab changes, window focus loss and, with the learner's consent, periodic camera snapshots; after a set number of violations (default 3) the attempt is submitted with the reason, and instructors review the log. |
| **FR-25** | The system MUST score attempts (score, percentage, pass), enforce the attempt limit under concurrency, keep graded attempts valid after the quiz changes, accept image answers only as images, queue open answers for grading, and complete the lesson when a later grading lifts the attempt to a pass. |
| **FR-26** | The system MUST show quiz statistics: attempts, pass rate, average score and per question the share answering correctly and the most chosen wrong option. |
| **FR-27** | A user with `LEARNING_COURSE_AUTHOR` can create assignments: prompt, answer kind (document, PDF, link, image, text or audio), optional model answer, open window, graded or not, and an optional rubric with weighted criteria. |
| **FR-28** | A learner can submit one answer per assignment (resubmitting replaces it until graded); a user with `LEARNING_INSTRUCT` grades it pass, fail, not graded or not applicable with comments and rubric scores; learners cannot grade themselves; the window is enforced; links are validated; attachments are private; the learner is notified of each outcome. |
| **FR-29** | A user with `LEARNING_COURSE_AUTHOR` can create programming exercises with starter code, language and visible or hidden test cases when a code runner is configured; submissions run in an isolated runner with time and memory limits, hidden expected outputs are never shown, and each run's results are kept. |
| **FR-30** | The system MUST let quizzes, assignments and exercises be placed in lessons and in cohort timetables, refuse a placement outside the course or cohort, and complete the lesson when its graded work passes. |

### 3.4 Enrolment, progress and paths

| ID | Requirement |
| --- | --- |
| **FR-31** | A learner with `LEARNING_LEARN` can enrol in a published free course open to them; a user with `LEARNING_ENROL_OTHERS` enrols others with role learner or mentor; duplicates and unpublished courses are refused and a paid course needs a confirmed purchase. |
| **FR-32** | A user with `LEARNING_ENROL_OTHERS` can enrol up to 500 learners at once into a course, cohort or path after a preview showing each row's outcome and reason, optionally recording a payment for them. |
| **FR-33** | The system MUST track per enrolment the current lesson and progress (completed lessons over all lessons, capped at 100 %), each lesson complete or partly complete with time spent, update the learner's outline live, and offer "continue". |
| **FR-34** | The system MUST show each learner's current and longest streak of learning days and an activity heat map of the last year. |
| **FR-35** | A user with `LEARNING_COURSE_MANAGE` can build learning paths: ordered courses (order enforced or not), members, published flag; duplicates are refused, an unpublished path cannot be joined, and path progress is recomputed when a course's progress changes. |
| **FR-36** | The system MUST assign paths or courses with a due date from rules: onboarding activities of `hr-core-lifecycle`, development areas of `performance-management`, a position or employee group, or a skill gap; it reminds before the due date and tells the manager when it passes. *(advanced)* |
| **FR-37** | The system MUST re-enrol holders of an expiring compliance certificate in the course a set number of days before expiry (default 30) and list people out of compliance per organization. *(advanced)* |

### 3.5 Cohorts, timetables and live classes

| ID | Requirement |
| --- | --- |
| **FR-38** | A user with `LEARNING_COHORT_MANAGE` can create a cohort: title, courses, instructors, seats, start and end dates, daily start and end times, time zone, online, in-person or blended mode, location, category, published flag, enrolment mode (open, approval, invitation) and a sanitised description block; end before start, start time after end time, negative seats and duplicate courses or instructors are refused; only the cohort's instructors change its instructors. |
| **FR-39** | A user with `LEARNING_COHORT_MANAGE` can build a cohort timetable of dated entries (lessons, live classes, assessments, milestones) inside the cohort's dates, from reusable timetable templates, with colours per entry kind and a day, week and list view. |
| **FR-40** | The system MUST check seats under concurrency, put learners on a waiting list when full and offer a freed seat to the next one for a set time (default 48 h), send a confirmation email, block duplicates and require payment first for a paid cohort. *(advanced: waiting list)* |
| **FR-41** | An instructor can post announcements to a cohort, delivered in-app and by email. |
| **FR-42** | A cohort learner can rate content, instructors and value and comment once per cohort. |
| **FR-43** | The system MUST show instructors a cohort dashboard: progress per learner and course, distribution per assessment, who is behind the timetable; and learners their own cohort page. |
| **FR-44** | A user with `LEARNING_COHORT_MANAGE` can schedule live classes on a cohort (host, date, time, duration) as meetings of `meetings` with calendar invitations of `calendar-and-scheduling` to members, reminders on the day, retries of failed invitations and a notice to the host when some fail. |
| **FR-45** | The system MUST record live class attendance from the meeting's participants (join, leave, duration) and let instructors mark in-person attendance, also by learners scanning a session code. *(advanced: in-person attendance)* |
| **FR-46** | The system MUST remind cohort members a set time before the cohort starts (default 1 day). |
| **FR-47** | The system MUST show a live class's recording and transcript to cohort members when `meetings` provides them. |

### 3.6 Certificates, evaluations and badges

| ID | Requirement |
| --- | --- |
| **FR-48** | The system MUST issue a certificate when progress reaches 100 % and certificates are on for the course, one per learner and course and one per learner and cohort, only to enrolled learners, with an optional expiry, rendered from a print template, emailed on issue and kept on the learner's profile. |
| **FR-49** | The system MUST give each certificate a verification code and a public check page (also reached by a printed code) showing learner name, course, issue and expiry dates and whether it is valid, expired or revoked; a user with `LEARNING_CERTIFICATE_MANAGE` can revoke with a reason. *(advanced)* |
| **FR-50** | A user with `LEARNING_COURSE_MANAGE` can make certification require an evaluation (refused together with completion-based certificates on the same course), with evaluators, time zone and an optional price. |
| **FR-51** | An evaluator with `LEARNING_EVALUATE` keeps weekly hours as their availability and absences as time off; a learner books a free slot on the course's evaluation booking page of `calendar-and-scheduling` (else a signed appointment link) with a calendar invitation and meeting link; double booking is refused under concurrency, past slots and slots after the cohort's evaluation end are never offered, and a learner holds one upcoming booking per course. |
| **FR-52** | The system MUST keep an evaluation booking upcoming, done or cancelled and its result pending, in progress, passed or failed with rating and summary; a pass issues the certificate; past bookings close by themselves and both sides are reminded the day before. |
| **FR-53** | A user with `LEARNING_CERTIFICATE_MANAGE` can issue certificates to many cohort members at once with a result per member. |
| **FR-54** | The system MUST offer a public feed of certified learners who opted in, filterable by category, which an Ever Works site renders as a directory. |
| **FR-55** | A user with `LEARNING_COURSE_MANAGE` can define badges awarded by rules (course or path completed, quiz score at least, streak of days) or by hand to people picked by a filter, each granted once, shown on the profile and recorded among the person's recognitions of `automation-and-notifications` when it is loaded; automation flows can award them on any record type. |

### 3.7 Paid learning

| ID | Requirement |
| --- | --- |
| **FR-56** | A user with `LEARNING_COMMERCE_MANAGE` can sell a course, cohort, path or certification as an item of the item catalogue with its price lists; buying it places an order paid through the hosted payment of `payment-gateways` and invoiced from the order, and grants the platform's right of access (an entitlement), which opens the content only once the payment is confirmed, with the order and payment kept. |
| **FR-57** | The system MUST apply coupons of `pricing-and-promotions` limited to the chosen learning items, with expiry, usage limit and on or off. |
| **FR-58** | The system MUST collect the buyer's billing address and tax identifiers at checkout and compute tax through `tax-engine`, with country exceptions and rounding as configured there. |
| **FR-59** | The system MUST remind buyers with an unpaid checkout after a set number of days, with separate switches for courses and cohorts, and stop when paid or cancelled. |
| **FR-60** | A user with `LEARNING_COMMERCE_MANAGE` can record a payment received outside the gateway on a learner's order, which completes the order and so confirms the enrolment, and see learning orders and transactions; gateway accounts are configured in `payment-gateways`. |
| **FR-61** | The system MUST revoke or keep the right of access on refund according to the item's refund rule (default revoke unless the course is complete), and sell paths and catalogue access as subscription plans of `subscription-billing` whose subscription keeps the right in force. *(advanced)* |

### 3.8 Community, profiles and notifications

| ID | Requirement |
| --- | --- |
| **FR-62** | An enrolled learner can rate and review a course once; the course shows its average rating, updated within an hour; a course sold as a catalogue item is reviewed as that product, in the platform's one product review and moderation queue. |
| **FR-63** | The system MUST give portal learners a profile (about, experience, education, skills, interests, certificates, badges) and show employees their learning on their existing profile; other plugins can add profile tabs. |
| **FR-64** | A learner can ask for a mentor on a course; a user with `LEARNING_INSTRUCT` accepts and maps the mentor; both are emailed at each change. |
| **FR-65** | The learning portal can list the organization's public job openings of `recruitment` and let a learner apply with their profile and CV. |
| **FR-66** | The system MUST notify in-app and by the person's preferences on grading, mentions, replies, new course or cohort published (channel chosen per course or cohort) and reminders, through the notification categories of `automation-and-notifications`. |
| **FR-67** | The system MUST create a chat channel per cohort with its members when chat is on, and keep membership in sync. |

### 3.9 Training programmes and sessions

| ID | Requirement |
| --- | --- |
| **FR-68** | A user with `LEARNING_TRAINING_MANAGE` can maintain training programmes: name, organization, state (planned, completed, cancelled), trainer (employee or outside person), provider (a vendor), description, and the courses and sessions they contain. |
| **FR-69** | A user with `LEARNING_TRAINING_MANAGE` can schedule training sessions: kind (class, conference, exam, online, other, self-study, seminar, workshop), level, location, start and end (end before start refused), trainer, provider, introduction, certificate on or off, cost, and attendees each mandatory or optional. |
| **FR-70** | The system MUST invite attendees when a session is scheduled (with a calendar invitation when the calendar is on) and keep each attendee invited, confirmed, attended, absent, completed or feedback given. |
| **FR-71** | A user with `LEARNING_TRAINING_MANAGE` can record results after a session, once per session: hours, grade and comment per attendee; recording completes the session and its attendees and asks those present for feedback. |
| **FR-72** | An attendee who was present can give feedback on a completed session with results, once; absent attendees are refused. |
| **FR-73** | The system MUST provide completed trainings and courses per employee to `hr-core-lifecycle` for the skills view, with hours and certificates. |

### 3.10 Assistants and skills graph

| ID | Requirement |
| --- | --- |
| **FR-74** | A user with `LEARNING_COURSE_AUTHOR` can ask the assistant to draft quiz questions, a lesson summary or a glossary from selected lessons; each draft item cites its source passage and stays a draft until an instructor approves it. *(advanced)* |
| **FR-75** | A learner can ask the course tutor questions; it answers from the course's published content with links to the lessons, says when it does not know, never shows quiz answers and never reveals other learners' data. *(advanced)* |
| **FR-76** | A user with `LEARNING_COURSE_MANAGE` can link courses to the skills they teach with a target proficiency; completing such a course proposes a proficiency update to the learner's manager in `hr-core-lifecycle`, confirmed or declined by them. *(advanced)* |
| **FR-77** | The system MUST show, per employee, team and position, the gaps between required and held skills with the courses that close each gap. *(advanced)* |
| **FR-78** | The system MUST, when an organization opts in, record employees' time in lessons and live classes as tracked time on the organization's learning project, so learning hours appear in timesheets and costs. *(advanced)* |

### 3.11 Portal, settings, roles and setup

| ID | Requirement |
| --- | --- |
| **FR-79** | The system MUST offer a learner home (my courses, cohorts and paths, continue, upcoming live classes, streak) and an instructor and admin home (upcoming evaluations and live classes, own courses, upcoming cohorts, grading queue). |
| **FR-80** | A user with `LEARNING_SETTINGS_EDIT` can set the learning area's name, guest browsing on or off, portal self sign-up on or off, categories and learning email templates; the logo, colours, menus and search-engine metadata of the public catalogue are those of the Ever Works site that renders it. |
| **FR-81** | A user with `LEARNING_SETTINGS_EDIT` can give people the learning roles reviewer, course author, instructor, evaluator and learner (bundles of the keys of this feature) and invite them through the platform's invitations; only holders of a staff role can invite. |
| **FR-82** | The system MUST register learning commands and records with the command palette and global search, and make learner pages usable at phone width in the Gauzy web app, which installs on phones. |
| **FR-83** | The system MUST, when first enabled for an organization, show a setup checklist, add a sample course and default email templates, and send each new learner one welcome email. |
| **FR-84** | A user with `LEARNING_COURSE_MANAGE` can export a course (structure, lessons, assessments, files, instructors) as an archive and import one: unsafe paths refused, files copied with their visibility, colliding question names renamed, source authors dropped; exports are deleted after 7 days. |
| **FR-85** | The system MUST register import profiles for learners, enrolments, questions and training records with the mapped import. |

### 3.12 Reports and dashboards

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-86** | Course progress | How far each learner is in each course, bucketed 0–10, 11–40, 41–70, 71–99 and 100 % | course, cohort, path, learner kind |
| **FR-87** | Learning activity | Sign-ups, enrolments, lesson completions, course completions and certificates per day | date range, course, organization |
| **FR-88** | Cohort and assessment results | Who is behind in a cohort or course; quiz and assignment pass rates per assessment | cohort, course, assessment |
| **FR-89** | Compliance | Who holds, misses or is about to lose a required certificate *(advanced)* | organization, department, position, course |
| **FR-90** | Training sessions | Sessions by kind, hours, cost, attendance and feedback per programme | period, kind, provider, department |
| **FR-91** | Learning revenue | Sales, refunds and coupon use per course, cohort and path | period, item |

| ID | Requirement |
| --- | --- |
| **FR-92** | The system MUST provide an admin statistics page with totals and per-day charts for a date range: published courses, active learners, enrolments, completions and certified learners. |
| **FR-93** | The system MUST provide charts of certificates, enrolments, lesson completions and sign-ups over time, sessions by kind, and cards for sessions this month, active learners and overdue assignments. |

### 3.13 API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-94** | The system MUST expose every action through the REST API and register courses, lessons, cohorts, enrolments, attempts, submissions, certificates, paths, programmes and sessions as record types for saved views, global search, custom fields, approval definitions, print templates and automation triggers. |
| **FR-95** | The system MUST keep the content model free of employee assumptions: a learner refers to an employee, a contact person or a user, and courses, lessons and assessments serve every kind of learner without change. |
| **FR-96** | The system MUST publish events (course published, enrolment created and completed, lesson completed, attempt submitted and graded, certificate issued, expiring and revoked, cohort started, session completed, purchase confirmed) on the event outbox for automations, webhooks and real-time updates. |
| **FR-97** | The system MUST offer MCP tools to search the catalogue, read a learner's progress, enrol (preview first), draft a quiz or summary from content, grade with a preview, issue certificates (preview first) and list compliance gaps; mutating tools act with the caller's permissions and are marked as agent actions. *(advanced)* |
| **FR-98** | The system MUST grant `LEARNING_LEARN` to the employee role while the feature is on, and, with the feature off, load no route, menu entry, employee profile tab, public page or job of the feature while keeping its data. |
| **FR-99** | The system MUST record who, when, before and after for every change of a published course version, grade, certificate, enrolment and session result. |

## 4. Non-Functional Requirements

- **Performance**: catalogue page under 300 ms at the 95th percentile with 10,000 courses; lesson open under 500 ms;
  progress write under 100 ms; quiz submission scored under 1 s for 100 questions; cohort dashboard for 2,000 learners
  under 2 s; video served with range requests from `drive`.
- **Data volume and concurrency**: 1 million learners, 10 million enrolments and 100 million lesson progress rows per
  tenant; seat, attempt and slot counts safe under concurrency (one winner); optimistic versions on courses, cohorts
  and grades (`409`).
- **Reliability**: purchase confirmation, certificate issue and launch emails are idempotent; failures of the meeting,
  calendar, assistant or runner providers never block lessons.
- **Security & privacy**: tenant and organization scoped; lesson files served only to permitted viewers; camera
  snapshots only with consent, kept 30 days; leaves the platform: emails, calendar invitations, payment checkout,
  public certificate pages (name, course, dates only), course content sent to the tenant's AI provider and code to the
  configured runner.
- **Observability and audit**: grade and certificate history, enrolment sources, job runs (launch notices, reminders,
  expiry, waiting list offers, attendance import).
- **Accessibility and localization**: lessons, players and quizzes keyboard operable, captions shown when the video
  has them, screen-reader labels on question controls, every string in every shipped locale, right-to-left layouts,
  course content translatable per language.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant;
  additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Learner` | A person who learns: an employee, a contact person or a user |
| `Course`, `CourseVersion`, `CourseCategory` | A unit of learning with its published and draft versions, in a category |
| `CourseChapter`, `CourseLesson` | The outline of a course; a lesson made of content blocks |
| `ContentPackage` | A packaged e-learning module played as a chapter |
| `Question`, `Quiz`, `QuizAttempt` | A bank question; a quiz from questions or draws; one learner's attempt |
| `Assignment`, `AssignmentSubmission`, rubric | A graded task and a learner's answer |
| `Exercise`, `ExerciseRun` | A programming task and a run of a submission |
| `Enrolment`, `LessonProgress` | A learner in a course, cohort or path, and their progress per lesson |
| `LearningPath`, `AssignmentRule` | Ordered courses; a rule that enrols people with a due date |
| `Cohort`, `CohortSession`, `TimetableTemplate`, `WaitingListEntry` | A dated run of courses with seats and its timetable |
| `LiveClass`, `Attendance` | A meeting of a cohort and who attended it |
| `Certificate`, `CertificateEvaluation`, `EvaluatorSlot` | A completion record with verification; an evaluation and its booking |
| `Badge`, `BadgeAward` | An achievement and who received it |
| `TrainingProgramme`, `TrainingSession`, `SessionAttendee` | HR training and its participants with results and feedback |
| `LearningItemLink` | The catalogue item that sells a course, cohort, path or certification; a purchase is an order granting an entitlement |
| `CourseSkill` | A skill a course teaches with a target proficiency |
| `LearningSettings` | Branding, guest and sign-up settings, completion rules, roles |

## 6. Out of Scope

- Public catalogue and directory pages, their design and visitor analytics: an Ever Works site renders them from the feeds.
- Payment adapters, hosted checkout and refunds at the provider: `payment-gateways`; orders and the rights they grant:
  the existing order and entitlement plugins; invoices: `invoicing-receivables-payables`; coupons and price lists:
  `pricing-and-promotions`; tax: `tax-engine`; subscriptions: `subscription-billing`; product reviews: the existing
  product-reviews plugin.
- Meeting rooms, recordings and transcripts: `meetings`; calendar events and invitations: `calendar-and-scheduling`;
  file storage and streaming: `drive`; chat channels: `chat-messaging`; long-form community spaces: `discussions`.
- Skill proficiencies of employees: `hr-core-lifecycle`; development areas: `performance-management`; job openings:
  `recruitment`; automation engine and recognition points: `automation-and-notifications`; portal user types:
  `access-control-and-security`; report engine: `report-builder-and-dashboards`; print templates: `print-and-pdf-designer`.

## 7. Acceptance Criteria

- [ ] **AC-1** An author builds and submits a course; a reviewer publishes it; draft edits stay invisible until republished
      and completed lessons survive (advanced, versions) (FR-2–FR-4).
- [ ] **AC-2** Completion rules, sequential mode, video skipping and watched ranges behave as configured; a package
      chapter stores completion and resume state; an invalid package is refused (FR-13, FR-19, FR-20).
- [ ] **AC-3** Quizzes with every question kind, draws, negative marking, attempt limit under concurrency, monitoring
      auto-submit and manual grading behave as specified; statistics agree with attempts (FR-22, FR-23, FR-25).
- [ ] **AC-4** Assignments with rubric and exercises with hidden tests grade and complete lessons; learners cannot grade
      themselves (FR-28–FR-30).
- [ ] **AC-5** A cohort with seats, waiting list, timetable, live classes with attendance from participants and
      in-person scans runs end to end (FR-39, FR-40, FR-43, FR-45).
- [ ] **AC-6** Certificates issue at 100 %, verify on the public page, show revoked after revocation; evaluation
      booking refuses double booking (advanced, verification) (FR-48, FR-49, FR-53).
- [ ] **AC-7** A paid cohort with a coupon is bought online with tax and invoice; access opens only on confirmation;
      a refund revokes access (FR-56–FR-58).
- [ ] **AC-8** Paths are assigned from onboarding, a development area and a skill gap with due dates; an expiring
      certificate re-enrols its holder (advanced, assignment) (FR-36).
- [ ] **AC-9** Assistant drafts cite passages and stay hidden until approved; the tutor answers with lesson links and
      refuses quiz answers (advanced, assistant) (FR-74, FR-75).
- [ ] **AC-10** A training session with mandatory attendees records results once, asks only present attendees for
      feedback and shows on the employee's skills (FR-71, FR-72).
- [ ] **AC-11** The six reports, the statistics page, charts and cards return figures that agree with seeded data (FR-92, FR-93).
- [ ] **AC-12** A contact person and a portal user learn the same course as an employee (learner kinds) (FR-95).
- [ ] **AC-13** Denial answers `403`; concurrent edits `409`; MCP mutating tools return a preview first (FR-97).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-98).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_LEARNING`; nothing changes while the flag is off.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Quiz monitoring records tab and focus events by default; camera snapshots need the organization's choice and the
  learner's consent, with no face analysis (applied).
- Programming exercises need a code runner provider; without one the exercise block is hidden (applied).
- Refunds revoke access unless the course is complete (applied).
- Portal learners sign up only where the organization switches self sign-up on (applied); without the portal user types of
  `access-control-and-security`, they are users with a "Learner" role created for the tenant.
- Course pages may carry a sanitised description block; custom scripts on cohort pages are not accepted (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `learning` with UI plugins; no core table changes.
- [x] II Tenant/organization scoping — every record scoped; public pages resolve one organization.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_LEARNING`.
- [x] V Contracts and API first; backwards compatible — contracts and REST before UI; additive OpenAPI.
- [x] VI Permissions, privacy, security — thirteen keys; sanitised content; permission-checked files; consent for camera.
- [x] VII Real-time through the event bus — outbox events; outlines and dashboards update live.
- [x] VIII i18n and accessibility — every string a key in all locales; accessible players and quizzes.
- [x] IX Tests accompany the change — completion rules, attempts, seats, certificates, purchases, packages, assistants.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`performance-management`](../performance-management/spec.md),
  [`recruitment`](../recruitment/spec.md), [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md),
  [`pricing-and-promotions`](../pricing-and-promotions/spec.md), [`tax-engine`](../tax-engine/spec.md),
  [`subscription-billing`](../subscription-billing/spec.md), [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`data-import-export`](../data-import-export/spec.md),
  [`calendar-and-scheduling`](../calendar-and-scheduling/spec.md), [`documents-and-wiki`](../documents-and-wiki/spec.md),
  [`payment-gateways`](../payment-gateways/spec.md)
- Existing code (`packages/core/src/lib/`): `skills`, `employee`, `contact`, `organization-vendor`, `product`, `tags`,
  `comment`, `broadcast`, `availability-slots`; plugins `docs` (documents hub), `order`, `entitlement`,
  `product-reviews`, `payment`, `knowledge-base`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (learning), §2.8 (vertical apps), §3.7, §3.8, §3.10, §3.12
