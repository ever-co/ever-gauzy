/**
 * Legacy rich-text corpus audit — the pre-removal gate of 06-ckeditor-removal.md §4.4
 * (rollout slice S6 in §7, acceptance line "corpus audit executed with a passing gate"
 * in §11).
 *
 * WHAT IT DOES
 * ------------
 * For every row of the nine legacy rich-text fields listed in §5.1 it computes the exact
 * round-trip the replacement editor performs the first time somebody opens and saves that
 * field — `generateHTML(generateJSON(normalizeLegacyHtml(html), standard), standard)` —
 * using the **shipped** `standard` preset and the **shipped** pre-parse fixups, not a copy
 * of them. Each row is then classified into one of the three categories §4.4 asks for:
 *
 *   (a) zero-loss                 — the canonical semantic form is byte-identical.
 *   (b) attribute-normalization   — same elements, same text, different attributes
 *                                   (unmapped inline styles, editor classes, …).
 *                                   §4.2: "Loading is normalizing, not byte-stable."
 *   (c) dropped-elements          — at least one element did not survive, or text was lost.
 *                                   Reported as a per-tag histogram.
 *
 * THE GATE (§4.4): category (c) must consist **solely** of the deliberate non-coverage
 * list of §4.2 (form widgets, iframes, script-bearing markup) plus the normalizations the
 * shipped corpus suite already asserts as intentional. Any other dropped tag fails the
 * gate and must gain an extension/parse-rule in `presets/standard.preset.ts` — plus a
 * fixture in `packages/ui-core/shared/src/lib/rich-text-editor/legacy-html-corpus.spec.ts`
 * — before the removal proceeds.
 *
 * WHY IT IS NOT PART OF CI
 * ------------------------
 * The gate is a statement about *production content*, so it can only be answered against a
 * production-representative database snapshot. It is a manual, read-only, one-off run
 * (§4.4: "executed manually against a production-representative database snapshot"). The
 * durable half of the contract — synthetic corpora that fail the build on a coverage
 * regression — already lives in `legacy-html-corpus.spec.ts` and runs in CI.
 *
 * HOW TO RUN IT
 * -------------
 * 1. Restore a production-representative snapshot somewhere disposable. **Never point this
 *    at a live production database**: it is read-only (SELECT only, no writes anywhere in
 *    this file), but a full-table scan of nine columns on a busy primary is still rude.
 * 2. Point the standard Gauzy DB variables at the snapshot — the same names the API reads
 *    (`packages/config/src/lib/database.ts`):
 *
 *      DB_TYPE=postgres DB_HOST=… DB_PORT=5432 DB_NAME=… DB_USER=… DB_PASS=… \
 *      DB_SSL_MODE=…            # optional; a base64 CA bundle, as in the API
 *
 *    or put them in a file and pass `--env-file .env.snapshot`.
 * 3. Run it from the repository root:
 *
 *      npx ts-node --transpile-only --project tools/tsconfig.audit.json \
 *        tools/scripts/legacy-rich-text-audit.ts --json audit.json
 *
 *    Useful flags: `--limit 5000` (cap rows per field while smoke-testing),
 *    `--fields task.description,organization.overview` (subset), `--samples 10` (how many
 *    offending row ids to print per unexpected tag), `--self-test` (no database — verifies
 *    the classifier itself), `--help`.
 * 4. Record the printed verdict — and the `--json` artifact — on the S6 checklist.
 *
 * HOW TO READ THE RESULT
 * ----------------------
 * - `GATE: PASS` (exit code 0) — every dropped element is on the accepted list. The
 *   lossless-load contract of §4.2 holds for the real corpus; S7 may proceed.
 * - `GATE: FAIL` (exit code 1) — the "unexpected dropped tags" table names the tags and up
 *   to `--samples` row ids per tag. For each: decide extension vs. accepted drop, per §12
 *   open question 1 for `iframe`. Add the extension + a fixture, then re-run.
 * - `skipped (table not found)` — that plugin's tables are absent from the snapshot
 *   (job-proposal / knowledge-base are optional plugins). The gate cannot be claimed for a
 *   field that was never read; re-run against a snapshot that has them.
 * - Category (b) is informational: normalization is expected and accepted (§4.2). It only
 *   matters if a downstream consumer is byte-sensitive — see §4.3.
 *
 * Read-only by construction: the only SQL this file emits is `SELECT`.
 */

// MUST be first — installs the jsdom globals the TipTap imports below need at load time.
import './legacy-rich-text-audit.dom';

import type { Extensions } from '@tiptap/core';
import { generateHTML, generateJSON } from '@tiptap/html';
import type { DataSource } from 'typeorm';
import { writeFileSync } from 'fs';
import { normalizeLegacyHtml } from '../../packages/ui-core/shared/src/lib/rich-text-editor/legacy-html.util';
import { createStandardPreset } from '../../packages/ui-core/shared/src/lib/rich-text-editor/presets/standard.preset';

// ---------------------------------------------------------------------------
// Field inventory — 06-ckeditor-removal.md §5.1, one entry per row of the table.
// Table names come from the `@MultiORMEntity(...)` decorator of each entity; column names
// are the TypeORM property names, which this schema stores verbatim (camelCase, quoted).
// ---------------------------------------------------------------------------

interface LegacyField {
	/** Stable id used by `--fields` and as the JSON report key. */
	readonly id: string;
	/** `Entity.field` exactly as §5.1 spells it. */
	readonly label: string;
	readonly table: string;
	readonly column: string;
	/** Which package owns the entity — a missing table is only expected for plugins. */
	readonly owner: 'core' | 'plugin-job-proposal' | 'plugin-knowledge-base';
	/** §5.1 "Exposure" column, surfaced in the report so the risky rows read first. */
	readonly exposure: string;
}

const LEGACY_FIELDS: readonly LegacyField[] = [
	{
		id: 'task.description',
		label: 'Task.description',
		table: 'task',
		column: 'description',
		owner: 'core',
		exposure: 'internal'
	},
	{
		id: 'organization-project.description',
		label: 'OrganizationProject.description',
		table: 'organization_project',
		column: 'description',
		owner: 'core',
		exposure: 'internal'
	},
	{
		id: 'organization-project-module.description',
		label: 'OrganizationProjectModule.description',
		table: 'organization_project_module',
		column: 'description',
		owner: 'core',
		exposure: 'internal'
	},
	{
		id: 'employee.description',
		label: 'Employee.description',
		table: 'employee',
		column: 'description',
		owner: 'core',
		exposure: 'PUBLIC (public organization page)'
	},
	{
		id: 'organization.overview',
		label: 'Organization.overview',
		table: 'organization',
		column: 'overview',
		owner: 'core',
		exposure: 'PUBLIC (public organization page)'
	},
	{
		id: 'proposal.jobPostContent',
		label: 'Proposal.jobPostContent',
		table: 'proposal',
		column: 'jobPostContent',
		owner: 'plugin-job-proposal',
		exposure: 'internal'
	},
	{
		id: 'proposal.proposalContent',
		label: 'Proposal.proposalContent',
		table: 'proposal',
		column: 'proposalContent',
		owner: 'plugin-job-proposal',
		exposure: 'internal'
	},
	{
		id: 'employee-proposal-template.content',
		label: 'EmployeeProposalTemplate.content',
		table: 'employee_proposal_template',
		column: 'content',
		owner: 'plugin-job-proposal',
		exposure: 'internal + AI prompt input'
	},
	{
		id: 'help-center-article.data',
		label: 'HelpCenterArticle.data',
		table: 'knowledge_base_article',
		column: 'data',
		owner: 'plugin-knowledge-base',
		exposure: 'internal'
	}
];

// ---------------------------------------------------------------------------
// The accepted drop list — what category (c) is allowed to contain (§4.4 gate).
// ---------------------------------------------------------------------------

/**
 * §4.2 "Deliberate non-coverage (accepted, sanitizer-enforced)": constructs the legacy
 * `full-all` build could emit, that no extension reproduces and that the §5.2 sanitizer
 * strips anyway. Finding these is expected; finding *many* of them is the signal §12
 * open question 1 is about (real `iframe` usage → dedicated embed node, or accept).
 */
const DELIBERATE_NON_COVERAGE = new Set([
	'form',
	'input',
	'select',
	'textarea',
	'button',
	'label',
	'fieldset',
	'legend',
	'optgroup',
	'option',
	'iframe',
	'script',
	'noscript',
	'style',
	'object',
	'embed',
	'param',
	'svg',
	'math'
]);

/**
 * Structural rewrites the pipeline performs on purpose, each already asserted in
 * `legacy-html-corpus.spec.ts` ("intentional drops" / "editor-namespace artifacts") or
 * performed by `normalizeLegacyHtml()` before the schema ever sees the markup. They are
 * *shape* changes, not content loss — the text survives — so they must not fail the gate.
 */
const ACCEPTED_NORMALIZATIONS = new Set([
	'font', // rewritten to a styled <span> by normalizeLegacyHtml
	'figure', // unwrapped to image + caption paragraph
	'figcaption', // ditto
	'span', // an unstyled span carries no mark; styled spans survive via TextStyleKit
	'div', // unwrapped into paragraphs
	'col', // TableKit resize scaffolding
	'colgroup', // ditto
	'thead', // every row is folded into a single <tbody>
	'tfoot' // ditto
]);

const isAcceptedDrop = (tag: string): boolean => DELIBERATE_NON_COVERAGE.has(tag) || ACCEPTED_NORMALIZATIONS.has(tag);

// ---------------------------------------------------------------------------
// Round-trip + canonicalization.
//
// The canonical form below mirrors `legacy-html-corpus.spec.ts` deliberately: the audit
// must call "loss" exactly what the unit suite calls loss, or the gate and the regression
// tests would disagree. It is re-implemented rather than imported because that file is a
// Jest spec — importing it would execute `describe()` outside a test runner.
// ---------------------------------------------------------------------------

const STANDARD: Extensions = createStandardPreset().extensions;

/** Load into the schema and serialize back out — exactly what the CVA does on save. */
const roundTrip = (html: string): string => generateHTML(generateJSON(normalizeLegacyHtml(html), STANDARD), STANDARD);

/** Legacy tags TipTap canonicalizes to a single spelling; both sides get the canonical one. */
const TAG_ALIASES: Record<string, string> = {
	B: 'strong',
	I: 'em',
	STRIKE: 's',
	DEL: 's',
	DIV: 'p'
};

/** Structural attributes ProseMirror always writes out but that carry no author intent. */
const NOISE_ATTRIBUTES = new Set(['class', 'id', 'rel', 'data-pm-slice']);

/** Converts `rgb(r, g, b)` (what the DOM gives back for a hex colour) to `#rrggbb`. */
function canonicalColor(value: string): string {
	return value.replace(
		/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)/gi,
		(_match, r, g, b) => `#${[r, g, b].map((part: string) => Number(part).toString(16).padStart(2, '0')).join('')}`
	);
}

/**
 * Canonicalizes an inline `style` attribute: drops the resizable-table `min-width`
 * scaffolding, normalizes colour notation and whitespace, and sorts declarations so
 * declaration order can never fail a diff.
 */
function canonicalStyle(style: string): string {
	return (
		style
			.split(';')
			.map((declaration) => declaration.trim())
			.filter(Boolean)
			.map((declaration) => {
				const separator = declaration.indexOf(':');
				const property = declaration.slice(0, separator).trim().toLowerCase();
				const value = canonicalColor(
					declaration
						.slice(separator + 1)
						.trim()
						.toLowerCase()
				);
				return `${property}: ${value}`;
			})
			// TableKit's resize handles write min-width on the table and every <col>.
			.filter((declaration) => !declaration.startsWith('min-width:'))
			.sort()
			.join('; ')
	);
}

/** Recursively renames a tag, preserving children and attributes. */
function renameTags(root: Element, from: string, to: string): void {
	root.querySelectorAll(from.toLowerCase()).forEach((element) => {
		const replacement = element.ownerDocument.createElement(to);
		Array.from(element.attributes).forEach((attribute) =>
			replacement.setAttribute(attribute.name, attribute.value)
		);
		while (element.firstChild) {
			replacement.appendChild(element.firstChild);
		}
		element.replaceWith(replacement);
	});
}

/** Serializes an element tree with attributes in a stable (sorted) order. */
function serialize(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		// Re-encode through a throwaway element so both sides use one entity spelling.
		const holder = node.ownerDocument!.createElement('span');
		holder.textContent = node.nodeValue ?? '';
		return holder.innerHTML;
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return '';
	}
	const element = node as Element;
	const tag = element.tagName.toLowerCase();
	const attributes = Array.from(element.attributes)
		.filter((attribute) => !NOISE_ATTRIBUTES.has(attribute.name))
		.map((attribute) => {
			const value = attribute.name === 'style' ? canonicalStyle(attribute.value) : attribute.value;
			return { name: attribute.name, value };
		})
		.filter((attribute) => attribute.value !== '')
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((attribute) => ` ${attribute.name}="${attribute.value}"`)
		.join('');

	const children = Array.from(element.childNodes).map(serialize).join('');
	return `<${tag}${attributes}>${children}</${tag}>`;
}

/**
 * Reduces HTML to the canonical semantic form both sides of the diff are compared in,
 * removing only the differences the §4.2 compatibility contract explicitly tolerates.
 * Returns the canonical `<body>` so the caller can take both a census and a serialization
 * from one parse.
 */
function canonicalBody(html: string): HTMLElement {
	const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
	const body = parsed.body;

	Object.entries(TAG_ALIASES).forEach(([from, to]) => renameTags(body, from, to));

	// `<pre>text</pre>` is stored as a code block, i.e. `<pre><code>text</code></pre>`.
	body.querySelectorAll('pre').forEach((pre) => {
		if (!pre.querySelector('code')) {
			const code = parsed.createElement('code');
			while (pre.firstChild) {
				code.appendChild(pre.firstChild);
			}
			pre.appendChild(code);
		}
	});

	// TableKit renders every row inside a single <tbody> and adds a <colgroup>.
	body.querySelectorAll('table').forEach((table) => {
		table.querySelectorAll('colgroup').forEach((colgroup) => colgroup.remove());
		const rows = Array.from(table.querySelectorAll('tr'));
		table.querySelectorAll('thead, tfoot, tbody').forEach((section) => section.remove());
		const tbody = parsed.createElement('tbody');
		rows.forEach((row) => tbody.appendChild(row));
		table.appendChild(tbody);
	});

	// The Link extension applies a uniform safety policy to every anchor: hardened `rel`
	// (stripped as noise during serialization) and `target="_blank"`. Both are additive.
	body.querySelectorAll('a[target="_blank"]').forEach((anchor) => anchor.removeAttribute('target'));

	// Implicit spans are always written explicitly by ProseMirror.
	body.querySelectorAll('td, th').forEach((cell) => {
		['colspan', 'rowspan'].forEach((attribute) => {
			if (cell.getAttribute(attribute) === '1') {
				cell.removeAttribute(attribute);
			}
		});
	});

	// ProseMirror wraps list-item and table-cell content in a paragraph.
	body.querySelectorAll('li > p:only-child, td > p:only-child, th > p:only-child').forEach((paragraph) => {
		paragraph.replaceWith(...Array.from(paragraph.childNodes));
	});
	// A list item whose first child is a paragraph followed by a nested list.
	body.querySelectorAll('li > p:first-child').forEach((paragraph) => {
		paragraph.replaceWith(...Array.from(paragraph.childNodes));
	});

	return body;
}

const serializeBody = (body: HTMLElement): string => Array.from(body.childNodes).map(serialize).join('');

/** Element census: `tag -> occurrences`, taken from the canonical tree. */
function census(body: HTMLElement): Map<string, number> {
	const counts = new Map<string, number>();
	body.querySelectorAll('*').forEach((element) => {
		const tag = element.tagName.toLowerCase();
		counts.set(tag, (counts.get(tag) ?? 0) + 1);
	});
	return counts;
}

/** Whitespace-insensitive text content, the "did any character disappear" check. */
function textOf(body: HTMLElement): string {
	return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Classification.
// ---------------------------------------------------------------------------

type Category = 'zero-loss' | 'attribute-normalization' | 'dropped-elements' | 'error';

interface RowVerdict {
	readonly category: Category;
	/** `tag -> how many occurrences disappeared`. Only set for `dropped-elements`. */
	readonly dropped: Record<string, number>;
	/** True when text characters — not just markup — went missing. Always a gate failure. */
	readonly textLoss: boolean;
	/** Populated when the round-trip itself threw; the row is neither pass nor fail. */
	readonly error?: string;
}

/**
 * Runs one stored value through the editor's load→save pipeline and classifies the result
 * into the three §4.4 categories.
 */
export function classifyRow(html: string): RowVerdict {
	let output: string;
	try {
		output = roundTrip(html);
	} catch (error) {
		return {
			category: 'error',
			dropped: {},
			textLoss: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}

	// The source side is compared *after* `normalizeLegacyHtml`, because those fixups are
	// part of the shipped load path — auditing against the raw column would report the
	// deliberate `<font>`/`<figure>` rewrites as loss.
	const sourceBody = canonicalBody(normalizeLegacyHtml(html));
	const outputBody = canonicalBody(output);

	if (serializeBody(sourceBody) === serializeBody(outputBody)) {
		return { category: 'zero-loss', dropped: {}, textLoss: false };
	}

	const sourceCensus = census(sourceBody);
	const outputCensus = census(outputBody);
	const dropped: Record<string, number> = {};
	sourceCensus.forEach((count, tag) => {
		const missing = count - (outputCensus.get(tag) ?? 0);
		if (missing > 0) {
			dropped[tag] = missing;
		}
	});

	const textLoss = textOf(sourceBody) !== textOf(outputBody);
	if (Object.keys(dropped).length === 0 && !textLoss) {
		return { category: 'attribute-normalization', dropped: {}, textLoss: false };
	}
	return { category: 'dropped-elements', dropped, textLoss };
}

// ---------------------------------------------------------------------------
// Per-field accumulation.
// ---------------------------------------------------------------------------

interface FieldReport {
	readonly field: LegacyField;
	scanned: number;
	skipped?: string;
	zeroLoss: number;
	attributeNormalization: number;
	droppedElements: number;
	errors: number;
	/** Aggregate dropped-tag histogram across every row of the field. */
	readonly histogram: Map<string, number>;
	/** Row ids per dropped tag, capped at `--samples`, so a failure is investigable. */
	readonly samples: Map<string, string[]>;
	/** Row ids whose text content shrank — always investigate these first. */
	readonly textLossSamples: string[];
	/** First few round-trip exceptions, verbatim. */
	readonly errorSamples: string[];
}

function emptyReport(field: LegacyField): FieldReport {
	return {
		field,
		scanned: 0,
		zeroLoss: 0,
		attributeNormalization: 0,
		droppedElements: 0,
		errors: 0,
		histogram: new Map<string, number>(),
		samples: new Map<string, string[]>(),
		textLossSamples: [],
		errorSamples: []
	};
}

function record(report: FieldReport, id: string, verdict: RowVerdict, sampleLimit: number): void {
	report.scanned += 1;
	switch (verdict.category) {
		case 'zero-loss':
			report.zeroLoss += 1;
			return;
		case 'attribute-normalization':
			report.attributeNormalization += 1;
			return;
		case 'error':
			report.errors += 1;
			if (report.errorSamples.length < sampleLimit) {
				report.errorSamples.push(`${id}: ${verdict.error}`);
			}
			return;
		default:
			break;
	}

	report.droppedElements += 1;
	Object.entries(verdict.dropped).forEach(([tag, count]) => {
		report.histogram.set(tag, (report.histogram.get(tag) ?? 0) + count);
		const ids = report.samples.get(tag) ?? [];
		if (ids.length < sampleLimit) {
			ids.push(id);
		}
		report.samples.set(tag, ids);
	});
	if (verdict.textLoss && report.textLossSamples.length < sampleLimit) {
		report.textLossSamples.push(id);
	}
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

interface Options {
	readonly help: boolean;
	readonly selfTest: boolean;
	readonly limit: number | null;
	readonly batch: number;
	readonly samples: number;
	readonly fields: string[] | null;
	readonly json: string | null;
	readonly envFile: string | null;
}

function parseArgs(argv: string[]): Options {
	const value = (flag: string): string | null => {
		const index = argv.indexOf(flag);
		return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
	};
	const number = (flag: string, fallback: number | null): number | null => {
		const raw = value(flag);
		if (raw === null) {
			return fallback;
		}
		const parsed = Number.parseInt(raw, 10);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			throw new Error(`${flag} expects a positive integer, got "${raw}"`);
		}
		return parsed;
	};
	const fields = value('--fields');

	return {
		help: argv.includes('--help') || argv.includes('-h'),
		selfTest: argv.includes('--self-test'),
		limit: number('--limit', null),
		batch: number('--batch', 500) as number,
		samples: number('--samples', 10) as number,
		fields: fields
			? fields
					.split(',')
					.map((entry) => entry.trim())
					.filter(Boolean)
			: null,
		json: value('--json'),
		envFile: value('--env-file')
	};
}

const USAGE = `
Legacy rich-text corpus audit — 06-ckeditor-removal.md §4.4 (removal gate S6).

  npx ts-node --transpile-only --project tools/tsconfig.audit.json \\
    tools/scripts/legacy-rich-text-audit.ts [options]

Options
  --self-test            Verify the classifier against built-in fixtures. No database.
  --env-file <path>      Load DB_* variables from a dotenv file before connecting.
  --fields <a,b>         Audit only these field ids (default: all nine of §5.1).
  --limit <n>            Stop after n rows per field (default: every row).
  --batch <n>            Rows fetched per SELECT (default: 500).
  --samples <n>          Offending row ids kept per dropped tag (default: 10).
  --json <path>          Write the machine-readable report there.
  -h, --help             This text.

Database connection uses the standard Gauzy variables — DB_TYPE, DB_HOST, DB_PORT,
DB_NAME, DB_USER, DB_PASS, DB_SSL_MODE — against a production-representative SNAPSHOT.
The script only ever issues SELECT statements.

Exit codes: 0 gate passed · 1 gate failed · 2 the audit could not run.

Field ids:
${LEGACY_FIELDS.map((field) => `  ${field.id.padEnd(40)} ${field.table}."${field.column}"`).join('\n')}
`;

// ---------------------------------------------------------------------------
// Self-test — proves the classifier separates the three categories, without a snapshot.
// ---------------------------------------------------------------------------

/**
 * Each fixture pins one branch of `classifyRow`. They double as documentation of what the
 * three §4.4 categories mean in practice, which is the part of the report a reader has to
 * trust when the real run prints only counts.
 */
const SELF_TEST_CASES: { name: string; html: string; expected: Category; expectDropped?: string[] }[] = [
	{
		name: '(a) fully covered legacy markup round-trips with zero loss',
		html:
			'<h2 style="text-align: center;">Title</h2><p><strong>bold</strong> and <em>italic</em>' +
			' and <u>underline</u>.</p><ul><li>one</li><li>two</li></ul>' +
			'<table><tbody><tr><th>H</th><td colspan="2">cell</td></tr></tbody></table>' +
			'<p><a href="https://ever.co/x" target="_blank">link</a></p>',
		expected: 'zero-loss'
	},
	{
		name: '(a) legacy <font> and the align attribute are rewritten, not lost',
		html: '<p align="right"><font color="#ff0000" face="Verdana">coloured</font></p>',
		expected: 'zero-loss'
	},
	{
		name: '(b) an unmapped inline style is normalized away; elements and text survive',
		html: '<p style="margin-left: 40px;">indented paragraph</p>',
		expected: 'attribute-normalization'
	},
	{
		name: '(c) an iframe embed is dropped — accepted, §4.2 non-coverage',
		html: '<p>before</p><iframe src="https://x.test/embed"></iframe><p>after</p>',
		expected: 'dropped-elements',
		expectDropped: ['iframe']
	},
	{
		name: '(c) legacy form widgets are dropped — accepted, §4.2 non-coverage',
		html: '<p>before</p><form action="/x"><input name="q"><button>go</button></form>',
		expected: 'dropped-elements',
		expectDropped: ['form', 'input', 'button']
	},
	{
		name: '(c) an element outside the coverage set is dropped — this is what fails the gate',
		html: '<p>before</p><video src="https://x.test/v.mp4"></video>',
		expected: 'dropped-elements',
		expectDropped: ['video']
	}
];

function runSelfTest(): number {
	console.log('Self-test — classifier behaviour on built-in fixtures (no database).\n');
	let failures = 0;

	SELF_TEST_CASES.forEach((testCase) => {
		const verdict = classifyRow(testCase.html);
		const droppedTags = Object.keys(verdict.dropped).sort();
		const categoryOk = verdict.category === testCase.expected;
		const droppedOk = !testCase.expectDropped || testCase.expectDropped.every((tag) => droppedTags.includes(tag));
		const ok = categoryOk && droppedOk;

		if (!ok) {
			failures += 1;
		}
		console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${testCase.name}`);
		if (!ok) {
			console.log(
				`        expected ${testCase.expected}${
					testCase.expectDropped ? ` dropping ${testCase.expectDropped.join(', ')}` : ''
				}`
			);
			console.log(
				`        got      ${verdict.category}${
					droppedTags.length ? ` dropping ${droppedTags.join(', ')}` : ''
				}${verdict.error ? ` (${verdict.error})` : ''}`
			);
		}
	});

	// The accepted-drop list is the gate itself; a typo in it would silently pass a real
	// regression, so assert the two §4.2 exemplars resolve as accepted.
	['iframe', 'form', 'input'].forEach((tag) => {
		if (!isAcceptedDrop(tag)) {
			failures += 1;
			console.log(`  FAIL  "${tag}" must be on the accepted-drop list (§4.2 non-coverage)`);
		}
	});
	['video', 'audio', 'details'].forEach((tag) => {
		if (isAcceptedDrop(tag)) {
			failures += 1;
			console.log(`  FAIL  "${tag}" must NOT be accepted — it would hide a coverage gap`);
		}
	});

	console.log(`\n${failures === 0 ? 'Self-test PASSED' : `Self-test FAILED (${failures} problem(s))`}`);
	return failures === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Database access — read-only.
// ---------------------------------------------------------------------------

type DbType = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'better-sqlite3';

/** Identifier quoting differs per driver; everything else in the SELECT is portable. */
function quoteIdentifier(dbType: DbType, identifier: string): string {
	return dbType === 'mysql' || dbType === 'mariadb' ? `\`${identifier}\`` : `"${identifier}"`;
}

/**
 * Builds the DataSource options from the same environment variables the API reads
 * (`packages/config/src/lib/database.ts`), minus everything write-related: no migrations,
 * no entities, `synchronize` hard-off.
 */
async function connect(dbType: DbType): Promise<DataSource> {
	const { DataSource: DataSourceCtor } = await import('typeorm');
	const shared = {
		synchronize: false,
		migrationsRun: false,
		dropSchema: false,
		entities: [] as [],
		migrations: [] as [],
		logging: false as const
	};

	if (dbType === 'sqlite' || dbType === 'better-sqlite3') {
		const dataSource = new DataSourceCtor({
			type: dbType,
			database: process.env.DB_NAME || 'gauzy.sqlite3',
			...shared
		} as never);
		return dataSource.initialize();
	}

	const isPostgres = dbType === 'postgres';
	const sslMode = process.env.DB_SSL_MODE;
	const dataSource = new DataSourceCtor({
		type: dbType,
		host: process.env.DB_HOST || 'localhost',
		port: process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT, 10) : isPostgres ? 5432 : 3306,
		database: process.env.DB_NAME || (isPostgres ? 'postgres' : 'mysql'),
		username: process.env.DB_USER || (isPostgres ? 'postgres' : 'root'),
		password: process.env.DB_PASS || 'root',
		// Same contract as the API: DB_SSL_MODE carries a base64-encoded CA bundle.
		ssl: sslMode ? { rejectUnauthorized: true, ca: Buffer.from(sslMode, 'base64').toString() } : undefined,
		...shared
	} as never);
	return dataSource.initialize();
}

/**
 * Streams one field's non-empty values in id order and classifies each row.
 * A missing table (an optional plugin absent from the snapshot) is reported, not fatal.
 */
async function auditField(
	dataSource: DataSource,
	dbType: DbType,
	field: LegacyField,
	options: Options
): Promise<FieldReport> {
	const report = emptyReport(field);
	const table = quoteIdentifier(dbType, field.table);
	const column = quoteIdentifier(dbType, field.column);
	const id = quoteIdentifier(dbType, 'id');

	let offset = 0;
	for (;;) {
		const remaining =
			options.limit === null ? options.batch : Math.min(options.batch, options.limit - report.scanned);
		if (remaining <= 0) {
			break;
		}

		let rows: { id: string; value: string }[];
		try {
			rows = await dataSource.query(
				`SELECT ${id} AS id, ${column} AS value FROM ${table} ` +
					`WHERE ${column} IS NOT NULL AND ${column} <> '' ` +
					`ORDER BY ${id} LIMIT ${remaining} OFFSET ${offset}`
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			report.skipped =
				field.owner === 'core'
					? `query failed — ${message}`
					: `table not found (optional plugin "${field.owner}") — ${message}`;
			return report;
		}

		if (!rows.length) {
			break;
		}
		rows.forEach((row) => record(report, String(row.id), classifyRow(String(row.value)), options.samples));
		offset += rows.length;
		if (rows.length < remaining) {
			break;
		}
	}

	return report;
}

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------

function printFieldReport(report: FieldReport): void {
	const { field } = report;
	console.log(`\n${field.label}  —  ${field.table}."${field.column}"  [${field.exposure}]`);
	if (report.skipped) {
		console.log(`  SKIPPED: ${report.skipped}`);
		return;
	}
	if (report.scanned === 0) {
		console.log('  no non-empty rows');
		return;
	}

	const percent = (count: number): string => `${((count / report.scanned) * 100).toFixed(1)}%`;
	console.log(`  rows scanned                : ${report.scanned}`);
	console.log(`  (a) zero loss               : ${report.zeroLoss} (${percent(report.zeroLoss)})`);
	console.log(
		`  (b) attribute normalization : ${report.attributeNormalization} (${percent(report.attributeNormalization)})`
	);
	console.log(`  (c) dropped elements        : ${report.droppedElements} (${percent(report.droppedElements)})`);
	if (report.errors) {
		console.log(`  round-trip errors           : ${report.errors}`);
		report.errorSamples.forEach((sample) => console.log(`      ${sample}`));
	}

	if (report.histogram.size) {
		console.log('  dropped-tag histogram (rows affected shown as row ids):');
		Array.from(report.histogram.entries())
			.sort((a, b) => b[1] - a[1])
			.forEach(([tag, count]) => {
				const verdict = isAcceptedDrop(tag) ? 'accepted' : 'UNEXPECTED';
				const ids = report.samples.get(tag) ?? [];
				console.log(`      <${tag}> × ${count}  [${verdict}]  e.g. ${ids.join(', ') || '—'}`);
			});
	}
	if (report.textLossSamples.length) {
		console.log(`  TEXT LOSS in rows: ${report.textLossSamples.join(', ')}  ← always a gate failure`);
	}
}

/** Serializable form of the report, for `--json`. */
function toJson(reports: FieldReport[]) {
	return {
		generatedAt: new Date().toISOString(),
		spec: '06-ckeditor-removal.md §4.4 (gate), §4.2 (coverage contract), §7 slice S6',
		acceptedDrops: {
			deliberateNonCoverage: Array.from(DELIBERATE_NON_COVERAGE).sort(),
			acceptedNormalizations: Array.from(ACCEPTED_NORMALIZATIONS).sort()
		},
		fields: reports.map((report) => ({
			id: report.field.id,
			label: report.field.label,
			table: report.field.table,
			column: report.field.column,
			exposure: report.field.exposure,
			skipped: report.skipped ?? null,
			scanned: report.scanned,
			zeroLoss: report.zeroLoss,
			attributeNormalization: report.attributeNormalization,
			droppedElements: report.droppedElements,
			errors: report.errors,
			errorSamples: report.errorSamples,
			histogram: Object.fromEntries(report.histogram),
			unexpectedTags: Array.from(report.histogram.keys()).filter((tag) => !isAcceptedDrop(tag)),
			samples: Object.fromEntries(report.samples),
			textLossSamples: report.textLossSamples
		}))
	};
}

/**
 * The §4.4 gate: category (c) must contain only accepted tags, no text may be lost, and a
 * field that could not be read cannot be claimed as audited.
 */
function evaluateGate(reports: FieldReport[]): { passed: boolean; reasons: string[] } {
	const reasons: string[] = [];
	reports.forEach((report) => {
		if (report.skipped) {
			reasons.push(`${report.field.id}: not audited — ${report.skipped}`);
			return;
		}
		Array.from(report.histogram.entries())
			.filter(([tag]) => !isAcceptedDrop(tag))
			.forEach(([tag, count]) =>
				reasons.push(
					`${report.field.id}: <${tag}> dropped ${count}× — add an extension/parse-rule to ` +
						`presets/standard.preset.ts and a fixture to legacy-html-corpus.spec.ts`
				)
			);
		if (report.textLossSamples.length) {
			reasons.push(`${report.field.id}: text content lost in rows ${report.textLossSamples.join(', ')}`);
		}
		if (report.errors) {
			reasons.push(`${report.field.id}: ${report.errors} row(s) threw during the round-trip`);
		}
	});
	return { passed: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		console.log(USAGE);
		return 0;
	}
	if (options.selfTest) {
		return runSelfTest();
	}
	if (options.envFile) {
		const dotenv = await import('dotenv');
		dotenv.config({ path: options.envFile });
	}

	const dbType = (process.env.DB_TYPE || 'postgres') as DbType;
	const selected = options.fields
		? LEGACY_FIELDS.filter((field) => options.fields!.includes(field.id))
		: [...LEGACY_FIELDS];
	if (!selected.length) {
		console.error(`No field matched --fields. Known ids:\n${LEGACY_FIELDS.map((f) => `  ${f.id}`).join('\n')}`);
		return 2;
	}

	console.log('Legacy rich-text corpus audit — 06-ckeditor-removal.md §4.4');
	console.log(`Database: ${dbType} ${process.env.DB_HOST ?? ''}/${process.env.DB_NAME ?? ''} (read-only)`);
	console.log(
		`Fields  : ${selected.length} of ${LEGACY_FIELDS.length}${options.limit ? `, max ${options.limit} rows each` : ''}`
	);

	const dataSource = await connect(dbType);
	const reports: FieldReport[] = [];
	try {
		for (const field of selected) {
			reports.push(await auditField(dataSource, dbType, field, options));
		}
	} finally {
		await dataSource.destroy();
	}

	reports.forEach(printFieldReport);

	const totals = reports.reduce(
		(accumulator, report) => ({
			scanned: accumulator.scanned + report.scanned,
			zeroLoss: accumulator.zeroLoss + report.zeroLoss,
			attributeNormalization: accumulator.attributeNormalization + report.attributeNormalization,
			droppedElements: accumulator.droppedElements + report.droppedElements
		}),
		{ scanned: 0, zeroLoss: 0, attributeNormalization: 0, droppedElements: 0 }
	);
	console.log(
		`\nTotals: ${totals.scanned} rows — (a) ${totals.zeroLoss} · (b) ${totals.attributeNormalization} · ` +
			`(c) ${totals.droppedElements}`
	);

	if (options.json) {
		writeFileSync(options.json, `${JSON.stringify(toJson(reports), null, 2)}\n`, 'utf8');
		console.log(`Report written to ${options.json}`);
	}

	const gate = evaluateGate(reports);
	if (gate.passed) {
		console.log('\nGATE: PASS — every dropped element is on the §4.2 accepted list. S7 may proceed.');
		return 0;
	}
	console.log('\nGATE: FAIL');
	gate.reasons.forEach((reason) => console.log(`  - ${reason}`));
	console.log('\nFix the coverage gap (or accept it explicitly in §4.2), then re-run this audit.');
	return 1;
}

main()
	.then((code) => process.exit(code))
	.catch((error) => {
		console.error('\nThe audit could not run:');
		console.error(error instanceof Error ? (error.stack ?? error.message) : error);
		console.error(
			'\nIf the failure is a missing module, install the audit-only dependencies from the repository root:' +
				'\n  npm install --no-save jsdom typeorm pg dotenv'
		);
		process.exit(2);
	});
