/**
 * DO NOT EDIT BY HAND.
 *
 * Generated for @gauzy/plugin-legal-ui versioned alongside @ever-co/legal corpus.
 *
 * This document constitutes the Data Protection Impact Assessment (DPIA) Support Pack
 * published by Ever Technologies LTD pursuant to GDPR Article 28(3)(f) to assist customers
 * (Data Controllers) in fulfilling their assessment obligations under GDPR Article 35 and
 * Article 36.
 */
import { ILegalDocument } from '../models/legal-document.model';

export const LEGAL_DPIA_EN: ILegalDocument = {
	document: 'dpia',
	product: 'gauzy',
	productName: 'Ever Gauzy',
	domain: 'gauzy.co',
	entity: 'Ever Technologies LTD',
	entityId: 'ever-technologies-bg',
	locale: 'en',
	version: '1.0.0',
	effectiveDate: '2026-08-02',
	sha256: 'e601acf708f38979d84bcab7adb6ca7462990569c4ea53192ed4ec3207053d0f',
	title: 'Data Protection Impact Assessment (DPIA) Support Pack',
	html: `<h2 id="purpose-and-legal-context" tabindex="-1">1. Purpose and Legal Context</h2>
<p>This Data Protection Impact Assessment (DPIA) Support Pack is published by <strong>Ever Technologies LTD</strong> ("we", "our", or "us") for subscribers, employers, and administrators ("Customer", "Controller", or "you") using <strong>Ever Gauzy Cloud</strong> and the Ever Gauzy desktop tracking applications. It is intended to be incorporated directly into your own data protection impact assessment, presented to your appointed Data Protection Officer (DPO), submitted to works councils (<em>Betriebsrat</em> / <em>Comit\u00e9 d'entreprise</em>), and produced during regulatory audits.</p>

<h3 id="division-of-responsibilities-controller-vs-processor" tabindex="-1">Division of Responsibilities (Controller vs. Processor)</h3>
<p>Under the European Union General Data Protection Regulation (Regulation (EU) 2016/679, "GDPR") and the UK GDPR:</p>
<ul>
<li><strong>The Customer is the Data Controller (Article 4(7) GDPR):</strong> When you deploy Ever Gauzy to manage your workforce, track working hours, measure productivity, or verify contractor deliverables, you determine the purposes and means of processing. Article 35 GDPR explicitly places the legal obligation to conduct a DPIA on the Controller prior to commencing high-risk processing.</li>
<li><strong>Ever Gauzy is the Data Processor (Article 4(8) GDPR):</strong> We process Customer Personal Data exclusively on your documented instructions, as set out in our Data Processing Agreement (DPA).</li>
<li><strong>Statutory Duty to Assist (Article 28(3)(f) GDPR):</strong> As your processor, Article 28(3)(f) obliges us to <em>"assist the controller in ensuring compliance with the obligations pursuant to Articles 32 to 36 taking into account the nature of processing and the information available to the processor."</em></li>
</ul>
<p>This Support Pack discharges that statutory duty by providing complete, transparent, and binding technical and operational disclosures regarding the Ever Gauzy platform, eliminating the need for bilateral inquiry questionnaires.</p>

<h3 id="wp248-criteria-analysis-why-a-dpia-is-mandatory" tabindex="-1">Working Party 29 / EDPB Criteria Analysis: Why a DPIA is Mandatory</h3>
<p>The Article 29 Working Party (now the European Data Protection Board, EDPB) established nine criteria in <strong>Guidelines WP248 rev.01</strong> to determine whether a processing operation is "likely to result in a high risk" under Article 35(1) GDPR. As a general rule, satisfying <strong>two (2) or more criteria</strong> triggers a mandatory DPIA requirement. Continuous or interval workplace monitoring with Ever Gauzy meets <strong>at least five (5) criteria</strong>:</p>

<table>
<thead>
<tr>
<th>WP248 Criterion</th>
<th>Ever Gauzy Application &amp; Analysis</th>
<th>Threshold Met?</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>1. Evaluation or scoring</strong></td>
<td>The desktop agent computes active versus idle keyboard/mouse intervals and aggregates overall productivity percentages displayed on managerial dashboards.</td>
<td><strong>Yes</strong></td>
</tr>
<tr>
<td><strong>2. Systematic monitoring</strong></td>
<td>Periodic background screen captures, active window titles, and URL history are captured at scheduled or randomised intervals throughout the working day without requiring an individualized suspicion trigger.</td>
<td><strong>Yes</strong></td>
</tr>
<tr>
<td><strong>3. Vulnerable data subjects</strong></td>
<td>WP248 explicitly names employees and workers as vulnerable data subjects because of the structural imbalance of power between employer and employee.</td>
<td><strong>Yes</strong></td>
</tr>
<tr>
<td><strong>4. Innovative technology / automated telemetry</strong></td>
<td>Use of cross-platform background desktop agents (Windows, macOS, Linux) that programmatically capture OS window hooks, display frames, and hardware input counters.</td>
<td><strong>Yes</strong></td>
</tr>
<tr>
<td><strong>5. Matching or combining datasets</strong></td>
<td>Ever Gauzy correlates visual screen captures with active OS process titles, visited web domains, numeric keystroke/mouse activity rates, project task logs, and optional geolocation.</td>
<td><strong>Yes</strong></td>
</tr>
</tbody>
</table>

<p>Because the platform satisfies five criteria (where two is the statutory threshold), <strong>employers operating within the European Economic Area (EEA) or UK must treat the execution of a DPIA as a mandatory legal obligation prior to enabling desktop monitoring features.</strong></p>

<h3 id="national-member-state-provisions" tabindex="-1">National Member State Provisions</h3>
<ul>
<li><strong>Germany (\u00a7 38 BDSG):</strong> Section 38(1) sentence 2 of the German Federal Data Protection Act (<em>Bundesdatenschutzgesetz</em>) mandates the appointment of an internal or external Data Protection Officer (<em>Datenschutzbeauftragter</em>) whenever an entity conducts processing that is subject to a mandatory DPIA, <strong>regardless of employee headcount</strong>. Activating screen or activity capture in Germany immediately triggers this requirement.</li>
<li><strong>Netherlands (Article 36 GDPR Prior Consultation):</strong> Under published guidance from the Dutch Data Protection Authority (<em>Autoriteit Persoonsgegevens</em>), if high residual privacy risks cannot be mitigated (e.g. through strict blurring, short retention, and worker exit rights), the employer must engage in prior consultation with the supervisory authority before activating monitoring.</li>
<li><strong>France (CNIL):</strong> The CNIL strictly prohibits continuous employee screen or keystroke surveillance. Gauzy's built-in interval controls, client-side blurring, and transparency levers are essential to satisfy CNIL proportionality standards.</li>
<li><strong>Italy (Statuto dei Lavoratori):</strong> Article 4 of Law No. 300/1970 strictly requires formal agreement with trade union representatives (<em>rappresentanze sindacali aziendali</em>) or authorization from the Territorial Labor Inspectorate (<em>Ispettorato Territoriale del Lavoro</em>) prior to deploying tools from which remote worker control may derive.</li>
</ul>

<hr />

<h2 id="data-categories-captured-per-feature" tabindex="-1">2. Data Categories Captured Per Feature &amp; Negative Commitments</h2>
<p>A rigorous DPIA requires clarity on exactly what data is captured, as well as explicit, legally binding negative commitments regarding what is <em>never</em> recorded.</p>

<table>
<thead>
<tr>
<th>Feature</th>
<th>Data Categories Captured (Positive Scope)</th>
<th>Explicit Negative Commitments (What We Never Capture)</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Screen Capture (Screenshots)</strong></td>
<td>Compressed bitmap images (JPEG/WebP) of connected displays during an active timer session. Image metadata: UTC timestamp, employee UUID, organization UUID, display identifier, resolution. Optional multi-display capture or active-display-only capture. Optional client-side Gaussian blur.</td>
<td><strong>NO</strong> capture when timer is stopped or paused.<br /><strong>NO</strong> continuous video streaming by default.<br /><strong>NO</strong> hidden/stealth recording without user knowledge.<br /><strong>NO</strong> OCR text extraction or full-text indexing.<br /><strong>NO</strong> ingestion into AI/machine learning training sets.</td>
</tr>
<tr>
<td><strong>Activity Rates (Mouse &amp; Keyboard)</strong></td>
<td>Aggregate activity percentage computed per 10-minute time slot: ratio of active seconds with keyboard press or mouse movement/clicks against total slot elapsed time. Quantitative event counters (mouse click totals, movement units, keypress counts).</td>
<td><strong>NO KEYLOGGER.</strong> Specific keys, characters, passwords, credit card numbers, and message contents are <strong>NEVER</strong> intercepted, recorded, or stored.<br /><strong>NO</strong> screen coordinate tracking or cursor position recording.<br /><strong>NO</strong> clipboard reading.</td>
</tr>
<tr>
<td><strong>App and URL History</strong></td>
<td>Active foreground process executable name (e.g. <code>chrome.exe</code>, <code>code.exe</code>) and active window title text during active timer sessions. Visited domain/URL if Gauzy browser extension or window title URL parsing is enabled.</td>
<td><strong>NO</strong> deep packet inspection or network proxying.<br /><strong>NO</strong> SSL/TLS interception.<br /><strong>NO</strong> reading email body content, form field inputs, or page DOM contents.<br /><strong>NO</strong> scanning browser history outside active timer sessions.</td>
</tr>
<tr>
<td><strong>Camshot (Webcam Still Capture)</strong></td>
<td>Periodic still photograph from the user's connected camera taken only during active timer sessions when explicitly configured by administrators and permitted by OS hardware access dialogs.</td>
<td><strong>NO</strong> continuous webcam streaming.<br /><strong>NO</strong> facial recognition or biometric template extraction.<br /><strong>NO</strong> eye-tracking, gaze estimation, or emotion analysis.<br /><strong>NO</strong> clandestine activation bypassing hardware indicator LEDs.</td>
</tr>
<tr>
<td><strong>Soundshot (Audio Sampling)</strong></td>
<td>Periodic short ambient sound presence or decibel level sample during active timer sessions (strictly opt-in).</td>
<td><strong>NO</strong> continuous hot-mic wiretapping or continuous streaming.<br /><strong>NO</strong> speech-to-text transcription or spoken word analysis.<br /><strong>NO</strong> voiceprint identification or acoustic surveillance of private domestic conversations.</td>
</tr>
<tr>
<td><strong>Video Recording</strong></td>
<td>Short screen video clips or time-lapse snippets (if the video plugin is explicitly activated in organization settings).</td>
<td><strong>NO</strong> silent continuous video recording.<br /><strong>NO</strong> streaming without desktop indicator illumination.<br /><strong>NO</strong> recording when the user pauses or stops the task timer.</td>
</tr>
<tr>
<td><strong>Geolocation Tracking</strong></td>
<td>Latitude and longitude coordinates captured upon clock-in/out or during mobile time tracking when enabled and authorized by OS device permissions. IP-based country/region code detection for regulatory gating.</td>
<td><strong>NO</strong> continuous 24/7 background GPS tracking.<br /><strong>NO</strong> off-the-clock location tracking or movement breadcrumbing outside active working shifts.</td>
</tr>
<tr>
<td><strong>ActivityWatch &amp; WakaTime Ingest</strong></td>
<td>Development heartbeats (IDE name, active programming language, active project/file path) synchronized via open integration APIs.</td>
<td><strong>NO</strong> repository source code file content ingestion.<br /><strong>NO</strong> reading private cryptographic keys, <code>.env</code> environment variables, or repository secrets.</td>
</tr>
</tbody>
</table>

<hr />

<h2 id="capture-frequencies-and-randomisation" tabindex="-1">3. Capture Frequencies and Randomisation Mechanics</h2>

<h3 id="frequency-ranges-and-daily-capture-budgets" tabindex="-1">Frequency Ranges and Daily Capture Budgets</h3>
<p>Ever Gauzy does not use vague "reasonable frequency" defaults. Every capture feature operates within quantifiable, administrator-configurable numerical ranges:</p>

<table>
<thead>
<tr>
<th>Setting</th>
<th>Minimum Configurable</th>
<th>Default Setting</th>
<th>Maximum Configurable</th>
<th>Records Generated (8-Hour Workday at Default)</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Screenshot Frequency</strong></td>
<td>1 capture every 60 minutes</td>
<td><strong>1 capture every 10 minutes</strong></td>
<td>1 capture every 1 minute</td>
<td><strong>48 screenshots</strong> per worker / day</td>
</tr>
<tr>
<td><strong>Activity Rate Calculation</strong></td>
<td>1 calculation every 60 minutes</td>
<td><strong>1 calculation every 10 minutes</strong></td>
<td>1 calculation every 1 minute</td>
<td><strong>48 time-slot aggregates</strong> per worker / day</td>
</tr>
<tr>
<td><strong>Camshot Frequency</strong></td>
<td>1 capture every 60 minutes</td>
<td><strong>Disabled by default</strong> (1 per 10 min if on)</td>
<td>1 capture every 5 minutes</td>
<td><strong>0</strong> (or 48 if explicitly enabled)</td>
</tr>
<tr>
<td><strong>Soundshot Frequency</strong></td>
<td>1 sample every 60 minutes</td>
<td><strong>Disabled by default</strong> (1 per 10 min if on)</td>
<td>1 sample every 10 minutes</td>
<td><strong>0</strong> (or 48 if explicitly enabled)</td>
</tr>
</tbody>
</table>

<h3 id="what-randomisation-does-and-why-it-mitigates-risk" tabindex="-1">What Randomisation Does (Jitter Mechanics)</h3>
<p>When screenshot capture is configured to a 10-minute interval, administrators can choose between <strong>fixed clock boundaries</strong> and <strong>pseudo-randomised windows</strong>:</p>
<ul>
<li><strong>Fixed Clock Mode:</strong> The desktop agent triggers a screenshot at predetermined clock ticks (e.g. 09:00, 09:10, 09:20).</li>
<li><strong>Pseudo-Randomised Mode:</strong> Within each 10-minute slot, a pseudo-random seed generates an unpredictable offset (e.g. slot 1 captures at minute 03:42, slot 2 captures at minute 07:18, slot 3 captures at minute 01:05).</li>
</ul>
<p><strong>DPIA Risk Mitigation Rationale:</strong></p>
<ol>
<li><strong>Eliminates the "Panopticon Clock-Watching" Anxiety:</strong> In fixed mode, employees experience psychological stress as the clock approaches the 10-minute mark, often interrupting their cognitive flow to prepare their desktop. Randomisation distributes captures naturally, reducing surveillance-related stress.</li>
<li><strong>Prevents Metric Manipulation:</strong> In fixed mode, disengaged workers may artificially generate bursts of keystrokes immediately before the fixed mark. Randomisation provides an authentic, unbiased sample of work activity.</li>
<li><strong>Strict Data Parity:</strong> Randomisation changes <em>when</em> the capture occurs within the block, but <strong>does not increase the total number of captures</strong>. The daily data volume remains exactly 48 screenshots for an 8-hour shift.</li>
</ol>

<hr />

<h2 id="retention-windows-and-automated-purging" tabindex="-1">4. Retention Windows and Automated Purging</h2>
<p>To comply with the GDPR Article 5(1)(e) Storage Limitation principle, Ever Gauzy implements concrete, hard retention windows backed by automated deletion cron tasks rather than ambiguous "as long as necessary" statements.</p>

<table>
<thead>
<tr>
<th>Data Category</th>
<th>Default Retention</th>
<th>Configurable Range</th>
<th>Automated Purge Schedule &amp; Execution Method</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Screenshots &amp; Camshot Media</strong></td>
<td><strong>90 days</strong> (3 months)</td>
<td>7 days to 365 days</td>
<td><strong>Daily at 02:00 UTC:</strong> Automated cron job executes hard database deletion and sends S3/R2 <code>DeleteObjects</code> batch commands. Expired binaries are permanently erased; no soft-delete retention.</td>
</tr>
<tr>
<td><strong>Short Video Recordings</strong></td>
<td><strong>30 days</strong></td>
<td>7 days to 90 days</td>
<td><strong>Daily at 02:00 UTC:</strong> Hard deletion of video blobs from object storage.</td>
</tr>
<tr>
<td><strong>Activity Rates &amp; App/URL Logs</strong></td>
<td><strong>12 months</strong></td>
<td>1 month to 24 months</td>
<td><strong>Daily at 02:30 UTC:</strong> Rolling truncation of granular time-slot metrics older than configured threshold.</td>
</tr>
<tr>
<td><strong>Time Logs &amp; Basic Timesheets</strong></td>
<td><strong>12 months</strong> (Default)</td>
<td>12 months to 10 years</td>
<td>Configurable by Controller to satisfy statutory commercial, tax, and labor audit retention rules (e.g. \u00a7 257 HGB / \u00a7 147 AO in Germany, requiring 6 to 10 years for payroll and tax documentation).</td>
</tr>
<tr>
<td><strong>Administrative &amp; Audit Logs</strong></td>
<td><strong>36 months</strong> (3 years)</td>
<td>Fixed ceiling</td>
<td>Retained for security incident analysis, forensics, and non-repudiation of privileged supervisor access.</td>
</tr>
<tr>
<td><strong>Account Deletion (Tenant Exit)</strong></td>
<td><strong>30 days</strong> grace period</td>
<td>Immediate on written request</td>
<td>Upon contract termination or organization deletion, all tenant data across all databases and object buckets is hard-deleted within 30 days. Backup snapshots expire naturally within 30 days.</td>
</tr>
</tbody>
</table>

<hr />

<h2 id="storage-locations-and-hosting-regions" tabindex="-1">5. Storage Locations and Hosting Regions</h2>

<table>
<thead>
<tr>
<th>Component</th>
<th>Primary Hosting Location</th>
<th>Infrastructure Provider &amp; Jurisdiction</th>
<th>Encryption at Rest &amp; Security Controls</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Ever Gauzy Cloud API &amp; App</strong></td>
<td>Frankfurt am Main, Germany (EU Region)</td>
<td>Hetzner Online GmbH (Germany) / AWS <code>eu-central-1</code> (Frankfurt)</td>
<td>Dedicated VPC, hardened Linux kernels, strict firewall rules, ISO 27001 certified datacenter facilities.</td>
</tr>
<tr>
<td><strong>Relational Database (PostgreSQL)</strong></td>
<td>Frankfurt am Main, Germany (EU Region)</td>
<td>Hetzner Online GmbH / AWS RDS <code>eu-central-1</code></td>
<td>AES-256 block-level encryption at rest; multi-tenant logical schema separation via strict <code>tenantId</code> query encapsulation.</td>
</tr>
<tr>
<td><strong>Media Storage (Screenshots, Camshots)</strong></td>
<td>Frankfurt am Main, Germany (EU Region)</td>
<td>AWS S3 <code>eu-central-1</code> / Cloudflare R2 (EU jurisdiction) / Hetzner Storage Box EU</td>
<td>Server-Side Encryption with AES-256 (SSE-S3 / SSE-KMS); pre-signed short-lived URLs (15-minute expiry) for authenticated access.</td>
</tr>
<tr>
<td><strong>Automated Backup Snapshots</strong></td>
<td>Secondary EU Region (Ireland <code>eu-west-1</code> or Helsinki, Finland)</td>
<td>AWS / Hetzner Cloud EU</td>
<td>Encrypted with distinct customer-isolated KMS keys; daily snapshots with 30-day rolling expiration.</td>
</tr>
<tr>
<td><strong>Self-Hosted / On-Premise Edition</strong></td>
<td><strong>100% Customer-Controlled</strong></td>
<td>Customer's private infrastructure (Docker / Kubernetes / Bare Metal)</td>
<td><strong>Zero Telemetry:</strong> Self-hosted instances transmit zero telemetry, analytics, or captured media to Ever Technologies LTD.</td>
</tr>
</tbody>
</table>

<hr />

<h2 id="sub-processors-and-international-transfers" tabindex="-1">6. Sub-processors and International Data Transfers</h2>
<p>We maintain a minimal sub-processor footprint for Ever Gauzy Cloud. Every sub-processor is bound by Article 28-compliant Data Processing Addenda with strict technical safeguards.</p>

<table>
<thead>
<tr>
<th>Sub-processor</th>
<th>Corporate Headquarters &amp; Processing Location</th>
<th>Service Provided</th>
<th>Transfer Mechanism &amp; Safeguards (Chapter V GDPR)</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Hetzner Online GmbH</strong></td>
<td>Gunzenhausen, Germany<br />(Datacenters: Falkenstein/Nuremberg, Germany)</td>
<td>Core bare-metal and cloud hosting, PostgreSQL database, compute infrastructure.</td>
<td><strong>No international transfer.</strong> All data remains entirely within Germany (EEA). Direct GDPR Article 28 DPA.</td>
</tr>
<tr>
<td><strong>Cloudflare, Inc.</strong></td>
<td>San Francisco, CA, USA<br />(Global edge with EU data localization / R2 EU)</td>
<td>Content Delivery Network (CDN), DDoS mitigation, Web Application Firewall (WAF), encrypted media storage.</td>
<td>EU Standard Contractual Clauses (SCCs 2021/914, Module 3: Processor-to-Processor), UK International Data Transfer Addendum (IDTA), Transfer Impact Assessment (TIA), EU data boundary routing.</td>
</tr>
<tr>
<td><strong>Mailgun Technologies, Inc.</strong></td>
<td>San Antonio, TX, USA<br />(EU processing endpoint: <code>api.eu.mailgun.net</code>)</td>
<td>Transactional email delivery (password resets, invitation emails, automated alert digests).</td>
<td>EU endpoint data localization, EU SCCs Module 3, TIA, data encrypted in transit with TLS 1.3.</td>
</tr>
<tr>
<td><strong>Functional Software, Inc. (Sentry)</strong></td>
<td>San Francisco, CA, USA<br />(EU Cloud instance options available)</td>
<td>Application performance and error tracking.</td>
<td>EU SCCs Module 3, automated PII scrubbing (passwords, tokens, and email strings stripped before egress).</td>
</tr>
</tbody>
</table>

<h3 id="transfer-impact-assessment-tia-summary" tabindex="-1">Transfer Impact Assessment (TIA) Summary</h3>
<p>For sub-processors subject to United States jurisdiction (e.g. Cloudflare, Mailgun), Ever Technologies LTD has performed a Transfer Impact Assessment pursuant to the CJEU <em>Schrems II</em> judgment (Case C-311/18):</p>
<ol>
<li><strong>Technical Supplementary Measures:</strong> All data in transit is protected with TLS 1.3 (forward secrecy). All object storage is encrypted with AES-256. Stored screenshots and activity logs do not contain raw government identifiers or plaintext access credentials.</li>
<li><strong>Contractual Safeguards:</strong> We mandate European Commission Standard Contractual Clauses (Implementing Decision (EU) 2021/914, Module 3) and require vendors to challenge non-targeted or unlawful foreign governmental access requests.</li>
<li><strong>Organizational Controls:</strong> Only designated infrastructure engineers hold access keys, rotated on a 90-day cycle with multi-factor authentication enforced.</li>
</ol>

<hr />

<h2 id="technical-and-organisational-security-measures" tabindex="-1">7. Technical &amp; Organisational Measures (TOMs - Article 32 GDPR)</h2>
<p>In accordance with Article 32 GDPR, Ever Gauzy implements robust technical and organisational security measures:</p>
<ul>
<li><strong>Pseudonymization and Encryption:</strong>
  <ul>
    <li><strong>In Transit:</strong> Mandatory TLS 1.3 with modern cipher suites (e.g. ECDHE-ECDSA-AES256-GCM-SHA384); HSTS enforced with a 1-year preload header.</li>
    <li><strong>At Rest:</strong> AES-256 disk and block storage encryption across all database volumes and object storage buckets.</li>
    <li><strong>Identifiers:</strong> Internal data structures utilize UUIDv4 identifiers rather than human-readable names in foreign keys.</li>
  </ul>
</li>
<li><strong>Multi-Tenant Data Segregation:</strong>
  <ul>
    <li>Application-layer tenant isolation enforced on every database query through global TypeORM query filters scoping data strictly to <code>tenantId</code> and <code>organizationId</code>.</li>
    <li>Cross-tenant data leakage is prevented at both the database schema and API routing layers.</li>
  </ul>
</li>
<li><strong>Employee Access Parity (#9874):</strong>
  <ul>
    <li>Ever Gauzy includes the <code>allowEmployeeToSeeTrackedData</code> compliance control (defaulting to <code>true</code>). Monitored workers have full access to inspect every screenshot, activity percentage, and time entry recorded about them in real time, fulfilling their GDPR Article 15 right of access without administrative friction.</li>
  </ul>
</li>
<li><strong>Worker Autonomy &amp; Exit Gating (#9873):</strong>
  <ul>
    <li>In EEA and UK jurisdictions, desktop agents cannot be configured to lock or prohibit agent exit or logout. Workers retain complete autonomous control to exit or log out of the desktop agent at any time, protecting their fundamental right to disconnect.</li>
  </ul>
</li>
<li><strong>Visible Recording State:</strong>
  <ul>
    <li>Desktop applications display a non-suppressible active tracking icon in the system notification tray and active window title bar whenever tracking is active. Covert background monitoring is architecturally precluded.</li>
  </ul>
</li>
<li><strong>Privileged Access &amp; Forensic Audit Logging:</strong>
  <ul>
    <li>Administrative actions, configuration changes, user role escalations, and supervisor screenshot views generate structured audit records containing timestamp, acting user UUID, target resource, and IP address.</li>
  </ul>
</li>
</ul>

<hr />

<h2 id="privacy-lever-to-risk-mitigation-mapping" tabindex="-1">8. Privacy Lever-to-Risk Mitigation Mapping Matrix</h2>
<p>This table maps every privacy configuration lever available in Ever Gauzy directly to the specific data protection or fundamental rights risk it mitigates, enabling Controllers to document concrete safeguards in their DPIA.</p>

<table>
<thead>
<tr>
<th>Privacy Lever in Ever Gauzy</th>
<th>Configuration Details</th>
<th>Risk Mitigated</th>
<th>Residual Risk &amp; Recommended Controller Action</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>1. Client-Side Screenshot Blurring</strong></td>
<td>Applies a Gaussian blur filter on the client device prior to network transmission.</td>
<td><strong>Inadvertent capture of sensitive data</strong> (GDPR Article 9 special categories: medical records, banking details, private messages, credentials).</td>
<td><em>Low residual risk:</em> Blurring conceals text while preserving general window layout. Recommended as default for all knowledge workers.</td>
</tr>
<tr>
<td><strong>2. Frequency Stretching</strong></td>
<td>Adjustable capture interval from 1 minute to 60 minutes (default: 10 minutes).</td>
<td><strong>Disproportionate surveillance &amp; excessive data collection</strong> (GDPR Article 5(1)(c) Data Minimisation).</td>
<td><em>Controlled risk:</em> Stretching to 10 or 30 minutes reduces total volume by 90-97% compared to 1-minute intervals.</td>
</tr>
<tr>
<td><strong>3. Pseudo-Randomised Capture Window</strong></td>
<td>Jitters capture timing within the slot instead of taking screenshots at fixed clock ticks.</td>
<td><strong>Surveillance anxiety &amp; panopticon stress</strong> ("watching the clock"); artificial metric gaming.</td>
<td><em>Minimal risk:</em> Keeps total daily capture volume identical while reducing cognitive stress.</td>
</tr>
<tr>
<td><strong>4. Per-User and Per-Team Disable</strong></td>
<td>Granular permission toggles to turn off screenshots, activity rates, or tracking per employee or department.</td>
<td><strong>Inappropriate monitoring of sensitive roles</strong> (works council members, legal counsel, HR staff, company medical officers, executive officers).</td>
<td><em>Zero risk for disabled users:</em> Controllers should formally exempt protected employee categories in policy.</td>
</tr>
<tr>
<td><strong>5. Worker Access Parity (#9874)</strong></td>
<td>Organization setting <code>allowEmployeeToSeeTrackedData</code> (default: enabled).</td>
<td><strong>Information asymmetry &amp; covert evaluation</strong>; denial of GDPR Article 15 right of access.</td>
<td><em>Mitigated:</em> Workers can review all recorded data in real time and request correction under Article 16.</td>
</tr>
<tr>
<td><strong>6. EEA/UK Exit &amp; Logout Gating (#9873)</strong></td>
<td>Automated regulatory check: restrictions on agent exit and logout are strictly disabled for EEA and UK employees.</td>
<td><strong>Loss of worker autonomy &amp; violation of right to disconnect;</strong> forced monitoring outside working hours.</td>
<td><em>Mitigated:</em> Employees can terminate the agent at will upon concluding their working day.</td>
</tr>
<tr>
<td><strong>7. Visible Recording Indicator</strong></td>
<td>Permanent tray icon, recording glow, and status text displayed during active tracking sessions.</td>
<td><strong>Surreptitious / clandestine monitoring</strong> (strictly prohibited under European Court of Human Rights case law, e.g. <em>B\u0103rbulescu v. Romania</em>).</td>
<td><em>Mitigated:</em> Monitoring is strictly overt and transparent to the data subject at all times.</td>
</tr>
<tr>
<td><strong>8. Manual Time Deletion &amp; Media Scrub</strong></td>
<td>Deleting a time block instantly hard-purges all associated screenshots and activity records.</td>
<td><strong>Accidental capture of personal activity</strong> (e.g. employee forgot to stop timer before taking a lunch break or personal phone call).</td>
<td><em>Mitigated:</em> Employees can immediately scrub mistaken captures along with the corresponding time log.</td>
</tr>
<tr>
<td><strong>9. Strict Retention Ceilings</strong></td>
<td>Configurable retention (7 to 365 days, default 90 days) with automated daily 02:00 UTC hard purge.</td>
<td><strong>Indefinite data hoarding</strong> (GDPR Article 5(1)(e) Storage Limitation).</td>
<td><em>Mitigated:</em> Automatic permanent erasure prevents stale surveillance data accumulation.</td>
</tr>
<tr>
<td><strong>10. Camshot &amp; Soundshot Opt-In Only</strong></td>
<td>Webcam and microphone capture features are globally disabled by default and require explicit dual administrative activation.</td>
<td><strong>Severe intrusion into private domestic spheres,</strong> especially in remote work and home office settings.</td>
<td><em>Residual risk high if enabled:</em> Recommended to remain permanently <strong>DISABLED</strong> for standard workplace monitoring.</td>
</tr>
</tbody>
</table>

<hr />

<h2 id="controller-compliance-checklist" tabindex="-1">9. Controller Step-by-Step Compliance Checklist</h2>
<p>To finalize your internal DPIA using this Support Pack, execute the following steps within your organization:</p>
<ol>
<li><strong>Document the Lawful Basis (Article 6 GDPR):</strong>
  <ul>
    <li>For workforce management in the EU, the lawful basis is typically <strong>Legitimate Interests (Article 6(1)(f) GDPR)</strong> or <strong>Performance of a Contract (Article 6(1)(b) GDPR)</strong>.</li>
    <li><em>Note on Consent (Article 6(1)(a) GDPR):</em> EDPB guidelines confirm that employee consent is rarely valid due to the imbalance of power. Rely on legitimate interests supported by this DPIA rather than consent forms.</li>
  </ul>
</li>
<li><strong>Configure Default Privacy Levers:</strong>
  <ul>
    <li>Enable <strong>Client-Side Blurring</strong> for screenshots.</li>
    <li>Set capture frequency to <strong>10 minutes or longer</strong>.</li>
    <li>Ensure <code>allowEmployeeToSeeTrackedData</code> is set to <strong>true</strong>.</li>
    <li>Leave <strong>Camshot and Soundshot disabled</strong> unless an exceptional, documented security justification exists.</li>
    <li>Set media retention to <strong>90 days or less</strong>.</li>
  </ul>
</li>
<li><strong>Consult Employee Representatives:</strong>
  <ul>
    <li>Under Article 35(9) GDPR, where appropriate, seek the views of data subjects or their representatives (e.g. Works Council / <em>Betriebsrat</em> / Trade Union). Present this document along with your balancing of interests test.</li>
  </ul>
</li>
<li><strong>Incorporate into Article 30 Records of Processing Activities (ROPA):</strong>
  <ul>
    <li>Update your ROPA to reflect Ever Gauzy Cloud as processor, referencing our DPA and this DPIA Support Pack.</li>
  </ul>
</li>
<li><strong>Need Further Assistance?</strong>
  <ul>
    <li>Pursuant to our DPA Article 28(3)(f) commitment, if your Supervisory Authority or internal DPO requires customized technical questionnaire answers, contact our privacy engineering team at <a href="mailto:privacy@ever.co">privacy@ever.co</a>.</li>
  </ul>
</li>
</ol>`
};
