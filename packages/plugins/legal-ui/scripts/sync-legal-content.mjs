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
 * After running, review the diff and commit the regenerated files.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
 */
const DOCUMENTS = [
	{ slug: 'tos', constant: 'LEGAL_TOS_EN', file: 'tos.en.generated.ts', title: 'Terms of Service' },
	{ slug: 'privacy', constant: 'LEGAL_PRIVACY_EN', file: 'privacy.en.generated.ts', title: 'Privacy Policy' },
	{ slug: 'cookies', constant: 'LEGAL_COOKIES_EN', file: 'cookies.en.generated.ts', title: 'Cookie Policy' }
];

/**
 * Parses the command line arguments this script understands.
 *
 * @returns The parsed options
 */
function parseArgs() {
	const argv = process.argv.slice(2);
	const options = { corpus: null, fetch: false, corpusVersion: 'latest' };

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
			default:
				throw new Error(`Unknown argument: ${argv[i]}`);
		}
	}

	return options;
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
 * @param corpusVersion version of the `@ever-co/legal` package the text came from
 * @param corpusMeta the `corpus` block of the corpus `index.json`
 * @returns TypeScript source text
 */
function renderIndexModule(corpusVersion, corpusMeta) {
	const imports = DOCUMENTS.map(
		(doc) => `import { ${doc.constant} } from './${doc.file.replace(/\.ts$/, '')}';`
	).join('\n');

	const members = DOCUMENTS.map((doc) => doc.constant).join(', ');

	return `/**
 * DO NOT EDIT BY HAND.
 *
 * Generated by packages/plugins/legal-ui/scripts/sync-legal-content.mjs from
 * ${CORPUS_PACKAGE}@${corpusVersion}.
 *
 * Run \`node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch\` to refresh.
 */
import { ILegalDocument } from '../models/legal-document.model';
${imports}

/** npm package the legal text was vendored from. */
export const LEGAL_CORPUS_PACKAGE = '${escapeSingleQuoted(CORPUS_PACKAGE)}';

/** Version of {@link LEGAL_CORPUS_PACKAGE} the bundled text was generated from. */
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
export const LEGAL_CORPUS: readonly ILegalDocument[] = [${members}];

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

	for (const descriptor of DOCUMENTS) {
		const meta = index.documents.find(
			(entry) => entry.document === descriptor.slug && entry.product === PRODUCT && entry.locale === LOCALE
		);

		if (!meta) {
			throw new Error(`Corpus has no '${descriptor.slug}' document for product '${PRODUCT}' (${LOCALE}).`);
		}

		if (meta.publishable === false) {
			throw new Error(`Corpus marks '${descriptor.slug}' for '${PRODUCT}' as not publishable - refusing.`);
		}

		const htmlPath = join(corpusDir, meta.path);
		const html = readFileSync(htmlPath, 'utf8');

		// The corpus pins each document by the sha256 of its Markdown source, so this only
		// checks that index.json and the per-document json agree about the same revision.
		const sidecarPath = htmlPath.replace(/\.html$/, '.json');
		const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
		if (sidecar.sha256 !== meta.sha256) {
			throw new Error(
				`Corpus is inconsistent for '${descriptor.slug}': index.json says ${meta.sha256}, ` +
					`${sidecarPath} says ${sidecar.sha256}.`
			);
		}

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

	writeFileSync(join(outputDir, 'index.ts'), renderIndexModule(corpusVersion, index.corpus), 'utf8');

	console.log(`Wrote ${DOCUMENTS.length + 1} files to ${outputDir}`);
}

main();
