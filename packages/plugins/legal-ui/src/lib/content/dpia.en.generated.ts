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
	sha256: '4fc4fb49c650392678d7b61e557575defa8564865bc0ea8ea6d1fce5de344b70',
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
<li><strong>Netherlands (Article 36 GDPR Prior Consultation):</strong> Under published guidance from the Dutch Data Protection Authority (<em>Autoriteit Persoonsgegevens</em>), if high residual privacy risks cannot be mitigated (e.g. through role-based exemptions, access parity, and worker exit rights), the employer must engage in prior consultation with the supervisory authority before activating monitoring.</li>
<li><strong>France (CNIL):</strong> The CNIL strictly prohibits continuous employee screen or keystroke surveillance. Gauzy's built-in interval controls, access parity, and worker exit rights are essential to satisfy CNIL proportionality standards.</li>
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
<td>Full-resolution bitmap images (PNG/JPEG) of connected displays during an active timer session, with server-generated thumbnails. Image metadata: UTC timestamp, employee UUID, organization UUID, display identifier, resolution. Optional multi-display capture or active-display-only capture. <em>Note:</em> Client-side blurring is currently not implemented by the desktop agent; original unblurred frames are captured and uploaded.</td>
<td><strong>NO</strong> capture when timer is stopped or paused.<br /><strong>NO</strong> continuous video streaming by default.<br /><strong>NO</strong> hidden/stealth recording without user knowledge.<br /><strong>NO</strong> OCR text extraction or full-text indexing.<br /><strong>NO</strong> ingestion into AI/machine learning training sets.</td>
</tr>
<tr>
<td><strong>Activity Rates (Mouse &amp; Keyboard)</strong></td>
<td>Aggregate activity percentage computed per time slot: ratio of active seconds with keyboard press or mouse movement/clicks against total slot elapsed time. Quantitative event counters (mouse click totals, movement units, keypress counts).</td>
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
<p>Ever Gauzy offers administrator-configurable capture frequencies within the defined options supported by the desktop client (<code>DEFAULT_SCREENSHOT_FREQUENCY_OPTIONS = [1, 3, 5, 10]</code> minutes):</p>

<table>
<thead>
<tr>
<th>Setting</th>
<th>Available Configurable Options</th>
<th>Default Setting</th>
<th>Records Generated (8-Hour Workday at Default 10-Min Setting)</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Screenshot Frequency (Fixed Mode)</strong></td>
<td><strong>1, 3, 5, or 10 minutes</strong></td>
<td><strong>1 capture every 10 minutes</strong></td>
<td><strong>48 screenshots</strong> per worker / day</td>
</tr>
<tr>
<td><strong>Screenshot Frequency (Random Mode)</strong></td>
<td>Dynamic selection from <strong>[1, 3, 5, 10] minutes</strong></td>
<td>Disabled by default</td>
<td><strong>~100 screenshots</strong> per worker / day (average ~4.75 min interval)</td>
</tr>
<tr>
<td><strong>Activity Rate Calculation</strong></td>
<td>1 calculation per active interval (1, 3, 5, or 10 min)</td>
<td><strong>1 calculation every 10 minutes</strong></td>
<td><strong>48 time-slot aggregates</strong> per worker / day (at 10-min setting)</td>
</tr>
<tr>
<td><strong>Camshot Frequency</strong></td>
<td>1 capture per configured interval (if enabled)</td>
<td><strong>Disabled by default</strong></td>
<td><strong>0</strong> (or 48 if explicitly enabled at 10-min setting)</td>
</tr>
<tr>
<td><strong>Soundshot Frequency</strong></td>
<td>1 sample per configured interval (if enabled)</td>
<td><strong>Disabled by default</strong></td>
<td><strong>0</strong> (or 48 if explicitly enabled at 10-min setting)</td>
</tr>
</tbody>
</table>

<h3 id="what-randomisation-does-and-why-it-mitigates-risk" tabindex="-1">What Randomisation Does (Dynamic Interval Mechanics)</h3>
<p>Administrators can configure the desktop agent to operate in <strong>fixed interval mode</strong> or <strong>random interval mode</strong>:</p>
<ul>
<li><strong>Fixed Interval Mode:</strong> The desktop agent triggers a screenshot at the fixed cadence selected in settings (1, 3, 5, or 10 minutes). At the standard 10-minute setting, this produces exactly 6 captures per hour (48 captures across an 8-hour shift).</li>
<li><strong>Random Interval Mode:</strong> When random interval is enabled, the timer dynamically re-samples the next capture interval from the predefined set <code>[1, 3, 5, 10]</code> minutes after every capture (implemented in <code>KbMouseTimer.getTimeNextScreenshot()</code>). Over time, this yields an average interval of approximately 4.75 minutes. Over an 8-hour continuous active shift, random mode produces an average of <strong>approximately 100 captures per day</strong> (ranging between ~48 and ~480 captures depending on the random sequence).</li>
</ul>
<p><strong>DPIA Impact &amp; Trade-off Analysis:</strong></p>
<ol>
<li><strong>Reduces Clock-Watching Surveillance Stress:</strong> Unpredictable capture timing prevents workers from constantly watching the clock or suffering anxiety spikes as a fixed deadline approaches.</li>
<li><strong>Prevents Metric Manipulation:</strong> Disengaged workers cannot game activity statistics by typing only at predetermined intervals.</li>
<li><strong>Important Volume Disclosure for Controllers:</strong> Because random mode selects dynamically from 1, 3, 5, and 10 minutes, <strong>random mode collects more captures on average (~100/day) than a fixed 10-minute setting (48/day)</strong>. Controllers conducting a DPIA must account for this higher capture volume when balancing data minimisation under GDPR Article 5(1)(c).</li>
</ol>

<hr />

<h2 id="retention-windows-and-automated-purging" tabindex="-1">4. Retention Arrangements and Storage Lifecycle</h2>
<p>To comply with the GDPR Article 5(1)(e) Storage Limitation principle, Controllers must define and enforce concrete retention policies for captured workforce data. Ever Gauzy's storage architecture operates as follows:</p>

<table>
<thead>
<tr>
<th>Data Category</th>
<th>Storage Arrangement &amp; Persistence</th>
<th>Controller Lifecycle Management &amp; Purge Options</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Screenshots &amp; Camshot Media</strong></td>
<td>Stored in configured object storage (AWS S3, Cloudflare R2, MinIO, or local filesystem). Stored persistently until deleted.</td>
<td><strong>Controller Lifecycle Policy:</strong> Controllers should configure storage bucket lifecycle expiration rules (e.g. AWS S3 Lifecycle Rule set to 90 days) on the media bucket to automatically expire old binaries. Cloud customers may also request automated retention sweeps or invoke administrative bulk deletion.</td>
</tr>
<tr>
<td><strong>Short Video Recordings</strong></td>
<td>Stored as media objects in object storage.</td>
<td>Subject to the same bucket lifecycle expiration rules or administrative deletion.</td>
</tr>
<tr>
<td><strong>Activity Rates &amp; App/URL Logs</strong></td>
<td>Stored as database records associated with time slots.</td>
<td>Retained in the database while corresponding time slots exist. Controllers can perform rolling database archival or truncation.</td>
</tr>
<tr>
<td><strong>Time Logs &amp; Basic Timesheets</strong></td>
<td>Relational database records.</td>
<td>Retained by the Controller as needed to satisfy statutory commercial, tax, and labor audit retention requirements (e.g. \u00a7 257 HGB / \u00a7 147 AO in Germany, requiring 6 to 10 years for payroll and tax documentation).</td>
</tr>
<tr>
<td><strong>Administrative &amp; Audit Logs</strong></td>
<td>Structured audit log entries.</td>
<td>Retained for up to 36 months for security incident analysis, forensics, and non-repudiation of privileged supervisor access.</td>
</tr>
<tr>
<td><strong>Account Deletion (Tenant Exit)</strong></td>
<td>Complete tenant data removal.</td>
<td>Upon contract termination or organization deletion, all tenant data across databases and object buckets is permanently deleted within 30 days. Backup snapshots expire naturally within 30 days.</td>
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
<td>Server-Side Encryption with AES-256 (SSE-S3 / SSE-KMS); pre-signed authenticated access URLs with 1-hour (3,600-second) expiry (<code>PRESIGNED_URL_EXPIRES_IN_SECONDS</code>).</td>
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
<td><strong>1. Visual Screen Capture Scope</strong></td>
<td>Captures display images in full visual resolution; client-side blurring is <strong>not implemented</strong> by the desktop agent.</td>
<td><strong>Inadvertent capture of sensitive personal data</strong> (GDPR Article 9 special categories: medical records, banking details, private messages, credentials).</td>
<td><em>High residual risk if unmanaged:</em> Because frames are captured unblurred, Controllers must not rely on automated masking. Mitigate by using longer intervals (10 min), excluding sensitive roles/departments via per-user disable, and enforcing clear acceptable use policies for personal browsing.</td>
</tr>
<tr>
<td><strong>2. Frequency Adjustment</strong></td>
<td>Configurable capture interval from 1, 3, 5, to 10 minutes (default: 10 minutes).</td>
<td><strong>Disproportionate surveillance &amp; excessive data collection</strong> (GDPR Article 5(1)(c) Data Minimisation).</td>
<td><em>Controlled risk:</em> Selecting the 10-minute interval reduces collection volume by 90% (48 captures/day) compared to the 1-minute interval (480 captures/day). Recommended as default.</td>
</tr>
<tr>
<td><strong>3. Random Interval Mode</strong></td>
<td>Randomly chooses the next capture interval from <code>[1, 3, 5, 10]</code> minutes after each capture.</td>
<td><strong>Surveillance anxiety &amp; panopticon stress</strong> ("watching the clock"); artificial metric gaming.</td>
<td><em>Increased collection volume:</em> Averages ~4.75 minutes between captures (~100 captures/8-hour shift vs. 48 for fixed 10-minute). Controllers must assess whether higher capture density is proportionate for their use case.</td>
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
<td><strong>8. Manual Time Deletion &amp; Soft-Removal</strong></td>
<td>Deleting a time block performs a <strong>soft-deletion</strong> in the database: time entries and screenshots are immediately removed from timesheets, dashboards, and reporting views. Permanent erasure from object storage occurs upon subsequent hard-delete or administrative purge.</td>
<td><strong>Accidental capture of personal activity</strong> (e.g. employee forgot to stop timer before taking a lunch break or personal phone call).</td>
<td><em>Partially mitigated:</em> Soft-deletion immediately hides accidental captures from all supervisory and reporting views. Permanent storage scrub requires administrative database/storage purge.</td>
</tr>
<tr>
<td><strong>9. Storage Lifecycle &amp; Retention Management</strong></td>
<td>Media is retained until deleted or purged. Controllers manage lifecycle limits via administrative bulk deletion or by establishing S3 object storage bucket lifecycle expiration rules (e.g. 90-day S3 expiration).</td>
<td><strong>Indefinite data hoarding</strong> (GDPR Article 5(1)(e) Storage Limitation).</td>
<td><em>Requires Controller action:</em> The application does not automatically hard-purge captures on an arbitrary built-in schedule; Controllers must implement storage lifecycle policies or regular administrative sweeps.</td>
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
    <li>Note that <strong>client-side blurring is not supported</strong>; protect sensitive data by exempting roles handling special category data (e.g., HR, medical, legal) and using the longest available interval.</li>
    <li>Set capture frequency to <strong>10 minutes (the maximum standard interval)</strong>.</li>
    <li>Ensure <code>allowEmployeeToSeeTrackedData</code> is set to <strong>true</strong>.</li>
    <li>Leave <strong>Camshot and Soundshot disabled</strong> unless an exceptional, documented security justification exists.</li>
    <li>Establish an <strong>S3 storage lifecycle policy (recommended 90 days or less)</strong> to automatically expire old screenshot objects from the storage bucket.</li>
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
