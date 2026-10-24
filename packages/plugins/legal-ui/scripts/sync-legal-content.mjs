#!/usr/bin/env node
/**
 * Regenerates the bundled legal corpus used by `@gauzy/plugin-legal-ui`.
 *
 * The legal text shipped inside the Gauzy UI is vendored from the published
 * `@ever-co/legal` package at *authoring* time and committed to this repository as plain
 * TypeScript. That is deliberate:
 *
 *   - the application performs **no network request** to render Terms / Privacy / Cookies,
 *   - the pages cannot go blank because a third party is unreachable or a subscription lapsed,
 *   - the exact text that shipped is reviewable in the diff and pinned by its `sha256`.
 *
 * Nothing in the build depends on `@ever-co/legal`; only this script does, and only when a
 * maintainer chooses to refresh the text.
 *
 * Usage:
 *
 *   # 1. Use an already-installed copy of the corpus
 *   node packages/plugins/legal-ui/scripts/sync-legal-content.mjs
 *
 *   # 2. Point at an extracted corpus (the `dist` folder of the package)
 *   node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --corpus /path/to/@ever-co/legal/dist
 *
 *   # 3. Let the script pull the published tarball into a temp folder (requires network)
 *   node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch
 *   node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch --corpus-version 0.1.0
 *
 *   # 4. Refresh only some documents and leave the others exactly as they are
 *   node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch --only dpia
 *   node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch --only tos,privacy,cookies
 *
 * `--only` exists because refreshing one document must not silently republish the others: the Terms, the
 * Privacy Policy and the Cookie Policy change what users agree to, and a new support document should not
 * drag a new version of them in with it. Each generated file records the corpus version it came from.
 *
 * Every requested document is checked against the corpus BEFORE anything is written, so a corpus that
 * lacks one of them (for example a version published before that document existed) fails the run without
 * leaving a half-refreshed set of files behind.
 *
 * After running, review the diff and commit the regenerated files.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, '..');
const outputDir = join(pluginRoot, 'src', 'lib', 'content');

/** npm package the corpus is vendored from. */
const CORPUS_PACKAGE = '@ever-co/legal';

/** Product identifier inside the corpus. Ever Gauzy documents live under `content/<doc>/gauzy/`. */
const PRODUCT = 'gauzy';

/** Locale to vendor. The corpus currently publishes English only. */
const LOCALE = 'en';

/**
 * Documents rendered by this plugin, in the order they are surfaced in the UI.
 *
 * `slug`     - document id inside the corpus
 * `constant` - exported constant name in the generated TypeScript
 * `file`     - generated file name
 * `title`    - display title, used when the rendered document has no top-level heading
 *              (the Cookie Policy starts at `h2`, so it has none)
 *
 * `dpia` is the DPIA Support Pack, first published in @ever-co/legal 0.5.0. Corpus versions before that do not
 * contain it, so refreshing the other documents from an older version needs `--only tos,privacy,cookies`.
 */
const DOCUMENTS = [
	{ slug: 'tos', constant: 'LEGAL_TOS_EN', file: 'tos.en.generated.ts', title: 'Terms of Service' },
	{ slug: 'privacy', constant: 'LEGAL_PRIVACY_EN', file: 'privacy.en.generated.ts', title: 'Privacy Policy' },
	{ slug: 'cookies', constant: 'LEGAL_COOKIES_EN', file: 'cookies.en.generated.ts', title: 'Cookie Policy' },
	{
		slug: 'dpia',
		constant: 'LEGAL_DPIA_EN',
		file: 'dpia.en.generated.ts',
		title: 'Data Protection Impact Assessment (DPIA) Support Pack'
	}
];

/**
 * Parses the command line arguments this script understands.
 *
 * @returns The parsed options
 */
function parseArgs() {
	const argv = process.argv.slice(2);
	const options = { corpus: null, fetch: false, corpusVersion: 'latest', only: null };

	for (let i = 0; i < argv.length; i++) {
		switch (argv[i]) {
			case '--corpus':
				options.corpus = argv[++i];
				break;
			case '--fetch':
				options.fetch = true;
				break;
			case '--corpus-version':
				options.corpusVersion = argv[++i];
				break;
			case '--only':
				options.only = String(argv[++i] ?? '')
					.split(',')
					.map((slug) => slug.trim())
					.filter(Boolean);
				break;
			default:
				throw new Error(`Unknown argument: ${argv[i]}`);
		}
	}

	if (options.only) {
		const known = DOCUMENTS.map((doc) => doc.slug);
		const unknown = options.only.filter((slug) => !known.includes(slug));
		if (!options.only.length || unknown.length) {
			throw new Error(
				`--only takes a comma-separated list of: ${known.join(', ')}` +
					(unknown.length ? ` (unknown: ${unknown.join(', ')})` : '')
			);
		}
	}

	return options;
}

/**
 * Reads `LEGAL_CORPUS_VERSION` from the barrel file currently on disk.
 *
 * Used by `--only`: the documents that were not refreshed still come from the version the last full refresh
 * used, so the barrel keeps announcing that version instead of the one a single document was taken from.
 *
 * @returns the version string, or null when the barrel does not exist or does not declare one
 */
function readCurrentCorpusVersion() {
	const barrel = join(outputDir, 'index.ts');
	if (!existsSync(barrel)) {
		return null;
	}
	const match = readFileSync(barrel, 'utf8').match(/export const LEGAL_CORPUS_VERSION = '([^']*)';/);
	return match ? match[1] : null;
}

/**
 * Downloads the published corpus tarball into a temporary directory and extracts it.
 *
 * @param version npm version (or dist-tag) to pack
 * @returns Absolute path to the extracted `dist` directory
 */
function fetchCorpus(version) {
	const workDir = mkdtempSync(join(tmpdir(), 'ever-legal-'));
	console.log(`Fetching ${CORPUS_PACKAGE}@${version} into ${workDir} ...`);

	execFileSync('npm', ['pack', `${CORPUS_PACKAGE}@${version}`], { cwd: workDir, stdio: 'inherit', shell: true });

	const tarball = readdirSync(workDir).find((name) => name.endsWith('.tgz'));
	if (!tarball) {
		throw new Error(`npm pack produced no tarball in ${workDir}`);
	}

	execFileSync('tar', ['-xzf', tarball], { cwd: workDir, stdio: 'inherit', shell: true });

	return join(workDir, 'package', 'dist');
}

/**
 * Works out where to read the corpus from.
 *
 * @param options parsed CLI options
 * @returns Absolute path to a corpus `dist` directory
 */
function resolveCorpusDir(options) {
	if (options.corpus) {
		return resolve(options.corpus);
	}

	if (options.fetch) {
		return fetchCorpus(options.corpusVersion);
	}

	try {
		// `exports["."]` of the package points at `dist/index.json`
		return dirname(require.resolve(`${CORPUS_PACKAGE}`));
	} catch {
		throw new Error(
			[
				`Could not resolve ${CORPUS_PACKAGE}.`,
				'',
				'It is intentionally NOT a dependency of this repository - the legal text is vendored',
				'into src/lib/content/*.generated.ts and committed, so neither the build nor the runtime',
				'needs it. To refresh the text, either install it locally or let this script fetch it:',
				'',
				'    node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch',
				''
			].join('\n')
		);
	}
}

/**
 * Removes the presentational front matter the corpus renders at the top of a document.
 *
 * `tos` and `privacy` start with three lines that repeat metadata we already have in
 * `index.json` and render ourselves in the page header:
 *
 *     <h1 id="terms-of-service" tabindex="-1">Terms of Service</h1>
 *     <p><strong>Ever Gauzy</strong> — <a href="https://gauzy.co">gauzy.co</a></p>
 *     <p>Version 1.0.0 · In force from 2026-08-02</p>
 *
 * `cookies` has none of them. Each line is removed only when it matches exactly, so a change in
 * the corpus degrades to "front matter shown twice", never to text being silently dropped. The
 * substantive body is never touched, and every document restates its version and effective date
 * in its closing paragraph.
 *
 * @param html raw document HTML
 * @param meta document entry from the corpus `index.json`
 * @returns the body HTML and whatever title was lifted out of it
 */
function stripFrontMatter(html, meta) {
	const lines = html.split(/\r?\n/);
	const stripped = [];
	let title = null;

	const heading = lines[0]?.match(/^<h1\b[^>]*>(.*)<\/h1>$/);
	if (heading) {
		title = heading[1].trim();
		stripped.push(lines.shift());

		// `<p><strong>Ever Gauzy</strong> — <a href="https://gauzy.co">gauzy.co</a></p>`
		if (/^<p><strong>[^<]*<\/strong>[^<]*<a href="[^"]*">[^<]*<\/a><\/p>$/.test(lines[0] ?? '')) {
			stripped.push(lines.shift());
		}

		// `<p>Version 1.0.0 · In force from 2026-08-02</p>`
		const versionLine = lines[0] ?? '';
		if (
			/^<p>[^<]*<\/p>$/.test(versionLine) &&
			versionLine.includes(meta.version) &&
			versionLine.includes(meta.effectiveDate)
		) {
			stripped.push(lines.shift());
		}
	}

	while (lines.length && lines[0].trim() === '') {
		lines.shift();
	}

	return { html: lines.join('\n'), title, stripped };
}

/**
 * Escapes a string so it can be embedded in a TypeScript template literal.
 *
 * Newlines are preserved on purpose so the generated files stay reviewable in a diff.
 *
 * @param value raw string
 * @returns escaped string
 */
function escapeTemplateLiteral(value) {
	return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

/**
 * Escapes a string for a single-quoted TypeScript string literal.
 *
 * @param value raw string
 * @returns escaped string
 */
function escapeSingleQuoted(value) {
	return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Builds the TypeScript source for one vendored document.
 *
 * @param descriptor entry of {@link DOCUMENTS}
 * @param meta document entry taken from the corpus `index.json`
 * @param body body HTML of the document, front matter already lifted out
 * @param title display title of the document
 * @param corpusVersion version of the `@ever-co/legal` package the text came from
 * @returns TypeScript source text
 */
function renderDocumentModule(descriptor, meta, body, title, corpusVersion) {
	return `/**
 * DO NOT EDIT BY HAND.
 *
 * Generated by packages/plugins/legal-ui/scripts/sync-legal-content.mjs from
 * ${CORPUS_PACKAGE}@${corpusVersion} (${meta.path}).
 *
 * The document's title, version and effective date come from the corpus index and are rendered
 * by the page header, so the corresponding front-matter lines are not repeated in \`html\`.
 *
 * Run \`node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch\` to refresh.
 */
import { ILegalDocument } from '../models/legal-document.model';

export const ${descriptor.constant}: ILegalDocument = {
	document: '${escapeSingleQuoted(meta.document)}',
	product: '${escapeSingleQuoted(meta.product)}',
	productName: '${escapeSingleQuoted(meta.productName)}',
	domain: '${escapeSingleQuoted(meta.domain)}',
	entity: '${escapeSingleQuoted(meta.entity)}',
	entityId: '${escapeSingleQuoted(meta.entityId)}',
	locale: '${escapeSingleQuoted(meta.locale)}',
	version: '${escapeSingleQuoted(meta.version)}',
	effectiveDate: '${escapeSingleQuoted(meta.effectiveDate)}',
	sha256: '${escapeSingleQuoted(meta.sha256)}',
	title: '${escapeSingleQuoted(title)}',
	html: \`${escapeTemplateLiteral(body)}\`
};
`;
}

/**
 * Builds the barrel file that assembles the vendored documents into a corpus.
 *
 * @param corpusVersion version of the `@ever-co/legal` package of the last full refresh
 * @param corpusMeta the `corpus` block of the corpus `index.json`
 * @returns TypeScript source text
 */
function renderIndexModule(corpusVersion, corpusMeta) {
	const imports = DOCUMENTS.map(
		(doc) => `import { ${doc.constant} } from './${doc.file.replace(/\.ts$/, '')}';`
	).join('\n');

	const members = DOCUMENTS.map((doc) => doc.constant).join(', ');

	// Keep the output stable under the repository's Prettier settings (printWidth 120), so a refresh never
	// shows a formatting-only diff.
	const corpusLine = `export const LEGAL_CORPUS: readonly ILegalDocument[] = [${members}];`;
	const corpusMembers = DOCUMENTS.map((doc) => `\t${doc.constant}`).join(',\n');
	const corpusDeclaration =
		corpusLine.length <= 120
			? corpusLine
			: `export const LEGAL_CORPUS: readonly ILegalDocument[] = [\n${corpusMembers}\n];`;

	return `/**
 * DO NOT EDIT BY HAND.
 *
 * Generated by packages/plugins/legal-ui/scripts/sync-legal-content.mjs from
 * ${CORPUS_PACKAGE}@${corpusVersion}. A document refreshed on its own with \`--only\` names the version it
 * came from in its own file header.
 *
 * Run \`node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch\` to refresh.
 */
import { ILegalDocument } from '../models/legal-document.model';
${imports}

/** npm package the legal text was vendored from. */
export const LEGAL_CORPUS_PACKAGE = '${escapeSingleQuoted(CORPUS_PACKAGE)}';

/**
 * Version of {@link LEGAL_CORPUS_PACKAGE} the last full refresh used. Each generated document records the
 * version it was actually taken from in its file header.
 */
export const LEGAL_CORPUS_VERSION = '${escapeSingleQuoted(corpusVersion)}';

/** Corpus the documents belong to, e.g. \`ever\` / \`ever.co\`. */
export const LEGAL_CORPUS_NAME = '${escapeSingleQuoted(corpusMeta?.name ?? '')}';

/** Product the bundled documents were rendered for. */
export const LEGAL_PRODUCT = '${escapeSingleQuoted(PRODUCT)}';

/** Locale used when no localized document exists. The corpus currently publishes English only. */
export const LEGAL_DEFAULT_LOCALE = '${escapeSingleQuoted(LOCALE)}';

/**
 * Every legal document bundled into the application.
 *
 * These are plain, build-time constants: rendering them performs no HTTP request and cannot
 * fail because a third-party service is unavailable.
 */
${corpusDeclaration}

export { ${members} };
`;
}

/**
 * Entry point.
 */
function main() {
	const options = parseArgs();
	const corpusDir = resolveCorpusDir(options);

	const indexPath = join(corpusDir, 'index.json');
	const index = JSON.parse(readFileSync(indexPath, 'utf8'));

	let corpusVersion = options.corpusVersion;
	try {
		// `dist/../package.json`
		corpusVersion = JSON.parse(readFileSync(join(corpusDir, '..', 'package.json'), 'utf8')).version;
	} catch {
		/* keep whatever the caller asked for */
	}

	console.log(`Reading ${CORPUS_PACKAGE}@${corpusVersion} from ${corpusDir}`);

	const selected = options.only ? DOCUMENTS.filter((doc) => options.only.includes(doc.slug)) : DOCUMENTS;

	// Phase 1: read and check every requested document. Nothing is written until all of them pass, so a
	// corpus that lacks one (an older version, a draft) cannot leave a half-refreshed set of files behind.
	const problems = [];
	const prepared = [];

	for (const descriptor of selected) {
		const meta = index.documents.find(
			(entry) => entry.document === descriptor.slug && entry.product === PRODUCT && entry.locale === LOCALE
		);

		if (!meta) {
			problems.push(`Corpus has no '${descriptor.slug}' document for product '${PRODUCT}' (${LOCALE}).`);
			continue;
		}

		if (meta.publishable === false) {
			problems.push(`Corpus marks '${descriptor.slug}' for '${PRODUCT}' as not publishable - refusing.`);
			continue;
		}

		const htmlPath = join(corpusDir, meta.path);
		const html = readFileSync(htmlPath, 'utf8');

		// The corpus pins each document by the sha256 of its Markdown source, so this only
		// checks that index.json and the per-document json agree about the same revision.
		const sidecarPath = htmlPath.replace(/\.html$/, '.json');
		const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
		if (sidecar.sha256 !== meta.sha256) {
			problems.push(
				`Corpus is inconsistent for '${descriptor.slug}': index.json says ${meta.sha256}, ` +
					`${sidecarPath} says ${sidecar.sha256}.`
			);
			continue;
		}

		prepared.push({ descriptor, meta, html });
	}

	if (problems.length) {
		const missing = selected
			.filter((doc) => !prepared.some((entry) => entry.descriptor === doc))
			.map((doc) => doc.slug);
		const available = selected.filter((doc) => !missing.includes(doc.slug)).map((doc) => doc.slug);
		throw new Error(
			[
				...problems,
				'',
				`Nothing was written. ${CORPUS_PACKAGE}@${corpusVersion} cannot provide: ${missing.join(', ')}.`,
				available.length
					? `To refresh the others from this version, run with --only ${available.join(',')}.`
					: 'Use a corpus version that contains these documents.'
			].join('\n')
		);
	}

	// Phase 2: write.
	for (const { descriptor, meta, html } of prepared) {
		const { html: body, title: liftedTitle, stripped } = stripFrontMatter(html, meta);
		const title = liftedTitle ?? descriptor.title;

		const source = renderDocumentModule(descriptor, meta, body, title, corpusVersion);
		writeFileSync(join(outputDir, descriptor.file), source, 'utf8');

		const htmlDigest = createHash('sha256').update(html).digest('hex');
		console.log(
			`  ${descriptor.slug.padEnd(8)} v${meta.version}  effective ${meta.effectiveDate}  ` +
				`title "${title}"  ${body.length} of ${html.length} chars  ` +
				`source-sha256 ${htmlDigest.slice(0, 12)}`
		);
		for (const line of stripped) {
			console.log(`             lifted into the page header: ${line}`);
		}
	}

	// A partial refresh leaves the other documents on the version the last full refresh used, and the barrel
	// keeps saying so. It is still regenerated, so a newly added document is imported.
	const barrelVersion = options.only ? (readCurrentCorpusVersion() ?? corpusVersion) : corpusVersion;
	writeFileSync(join(outputDir, 'index.ts'), renderIndexModule(barrelVersion, index.corpus), 'utf8');

	const skipped = DOCUMENTS.filter((doc) => !selected.includes(doc)).map((doc) => doc.slug);
	console.log(
		`Wrote ${prepared.length + 1} files to ${outputDir}` +
			(skipped.length ? ` (left untouched: ${skipped.join(', ')})` : '')
	);
}

main();
