#!/usr/bin/env node
/**
 * Gate: a UI translation carries every key of the English catalogue, with the same placeholders.
 *
 * The web UI reads its strings with ngx-translate from `packages/ui-core/i18n/assets/i18n/<lang>.json` (Crowdin maps
 * `en.json` to `%two_letters_code%.json`, and contributors also edit the language files directly). A key that is
 * missing from a language file does not fail anywhere: the UI silently shows the English text, so a translation
 * drifts out of date one feature at a time (#9448: Chinese had 6,030 of 7,007 keys). A value that drops or renames a
 * placeholder is worse: `{{ name }}` renders literally, or the value the code passes in disappears from the sentence.
 *
 * For each language asked for, the check
 *
 *   1. flattens the English catalogue and the translation to dotted key paths (`BUTTONS.SAVE`);
 *   2. reports the keys the translation lacks (they fall back to English at runtime) and the keys only it has
 *      (informational: an old key nobody reads any more costs nothing);
 *   3. compares the placeholders of every shared key, counting repeats, so a value that repeats or drops one is caught:
 *        - ngx-translate interpolations, `{{ name }}` (inner whitespace is not significant: `{{name}}` is the same);
 *        - HTML tags, by name and kind (`<strong>`, `</strong>`, `<br/>`); attributes are not compared, but an
 *          interpolation inside one (`<a href={{url}}>`) is, as an interpolation;
 *        - printf-style tokens (`%s`, `%d`, `%1$s`);
 *        - single-brace arguments, `{count}` (the nestjs-i18n format the API uses) and the argument of an ICU
 *          `{count, plural, ...}` / `{gender, select, ...}` (the branch texts are translatable and not compared);
 *   4. lists the values still identical to English (informational: brand names, codes and placeholders-only values
 *      are legitimately the same; everything else is untranslated text).
 *
 * It fails (exit 1) on a missing key or a placeholder mismatch for the languages named on the command line, so it can
 * hold one complete translation to parity without failing on the ones still in progress. `--all` reports every
 * language of the folder and fails only on a catalogue that cannot be read (invalid JSON): the UI then cannot load a
 * single string of that language. That is the mode CI runs; holding a language to parity in CI would require every
 * new English key to ship with its translation, which is a decision for the maintainers, not for this script.
 *
 * Run from the repository root:
 *
 *   node tools/scripts/i18n-parity-check.mjs zh
 *   node tools/scripts/i18n-parity-check.mjs zh --list missing          (also: extra, identical, placeholders)
 *   node tools/scripts/i18n-parity-check.mjs --all                      (report every language in the folder)
 *   node tools/scripts/i18n-parity-check.mjs zh --dir packages/plugins/dashboard-time-track-angular-ui/src/i18n
 *   node --test tools/scripts/i18n-parity-check.test.mjs
 *
 * No dependencies: plain Node, like the rest of `tools/scripts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** The web UI catalogues, relative to the repository root. */
export const DEFAULT_DIRECTORY = 'packages/ui-core/i18n/assets/i18n';

/** The catalogue every translation is measured against. */
export const SOURCE_LANGUAGE = 'en';

/** `{{ name }}`: an ngx-translate interpolation. */
const INTERPOLATION = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** An HTML tag: opening, closing (`</b>`) or self-closing (`<br/>`); the attributes are skipped. */
const HTML_TAG = /<(\/?)([A-Za-z][\w-]*)\b(?:[^<>"']|"[^"]*"|'[^']*')*?(\/?)>/g;

/** `%s`, `%d`, `%1$s`: a printf-style token. */
const PRINTF = /%(?:\d+\$)?(?:s|d|i|f)/g;

/** `{count}` or the head of an ICU argument, `{count, plural,`: a single-brace argument. */
const SINGLE_BRACE = /\{\s*([A-Za-z_][\w.]*)\s*(?:,\s*([A-Za-z]+)\s*)?[,}]/g;

/**
 * Flattens a nested catalogue to dotted key paths, in document order.
 *
 * @param {Record<string, unknown>} tree
 * @param {string} [prefix]
 * @param {Map<string, unknown>} [into]
 * @returns {Map<string, unknown>} key path -> leaf value (a string in a well-formed catalogue)
 */
export function flattenCatalogue(tree, prefix = '', into = new Map()) {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;

		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			flattenCatalogue(value, path, into);
		} else {
			into.set(path, value);
		}
	}

	return into;
}

/**
 * The placeholders of one value, normalized and sorted, so two values can be compared with repeats counted.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function placeholdersOf(value) {
	if (typeof value !== 'string') {
		return [];
	}

	const tokens = [];

	for (const [, expression] of value.matchAll(INTERPOLATION)) {
		tokens.push(`{{${expression.replace(/\s+/g, '')}}}`);
	}

	// Single braces are read once the interpolations are gone, so `{{ name }}` is not read twice.
	const withoutInterpolations = value.replace(INTERPOLATION, ' ');

	for (const [, name, kind] of withoutInterpolations.matchAll(SINGLE_BRACE)) {
		tokens.push(kind ? `{${name},${kind}}` : `{${name}}`);
	}

	for (const [, closing, name, selfClosing] of value.matchAll(HTML_TAG)) {
		tokens.push(`<${closing}${name.toLowerCase()}${selfClosing}>`);
	}

	for (const [token] of value.matchAll(PRINTF)) {
		tokens.push(token);
	}

	return tokens.sort();
}

/**
 * Whether two sorted token lists hold the same tokens, each as many times.
 *
 * @param {string[]} expected
 * @param {string[]} actual
 * @returns {boolean}
 */
function sameTokens(expected, actual) {
	return expected.length === actual.length && expected.every((token, index) => token === actual[index]);
}

/**
 * Compares a translation with the source catalogue.
 *
 * @param {Record<string, unknown>} source the English catalogue
 * @param {Record<string, unknown>} target the translation
 * @returns {{
 *   total: number,
 *   missing: string[],
 *   extra: string[],
 *   identical: string[],
 *   placeholderMismatches: { key: string, expected: string[], actual: string[] }[]
 * }}
 */
export function compareCatalogues(source, target) {
	const sourceKeys = flattenCatalogue(source);
	const targetKeys = flattenCatalogue(target);

	const missing = [];
	const identical = [];
	const placeholderMismatches = [];

	for (const [key, sourceValue] of sourceKeys) {
		if (!targetKeys.has(key)) {
			missing.push(key);
			continue;
		}

		const targetValue = targetKeys.get(key);

		if (targetValue === sourceValue) {
			identical.push(key);
		}

		const expected = placeholdersOf(sourceValue);
		const actual = placeholdersOf(targetValue);

		if (!sameTokens(expected, actual)) {
			placeholderMismatches.push({ key, expected, actual });
		}
	}

	const extra = [...targetKeys.keys()].filter((key) => !sourceKeys.has(key));

	return { total: sourceKeys.size, missing, extra, identical, placeholderMismatches };
}

/**
 * Whether a comparison holds the translation to parity: nothing missing, no placeholder lost or renamed.
 *
 * @param {ReturnType<typeof compareCatalogues>} result
 * @returns {boolean}
 */
export function isComplete(result) {
	return result.missing.length === 0 && result.placeholderMismatches.length === 0;
}

/**
 * A one-paragraph summary of a comparison.
 *
 * @param {string} language
 * @param {ReturnType<typeof compareCatalogues>} result
 * @returns {string}
 */
export function summarize(language, result) {
	const translated = result.total - result.missing.length;

	return [
		`${language}: ${translated}/${result.total} keys present`,
		`  missing (shown in English): ${result.missing.length}`,
		`  placeholder mismatches: ${result.placeholderMismatches.length}`,
		`  identical to English (review: brand names and codes are fine): ${result.identical.length}`,
		`  only in ${language} (unused by the UI): ${result.extra.length}`
	].join('\n');
}

/**
 * Reads the arguments of the command line.
 *
 * @param {string[]} argv
 * @returns {{ languages: string[], all: boolean, directory: string, list: string | null, json: boolean }}
 */
export function parseArguments(argv) {
	const options = { languages: [], all: false, directory: DEFAULT_DIRECTORY, list: null, json: false };

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];

		if (argument === '--all') {
			options.all = true;
		} else if (argument === '--json') {
			options.json = true;
		} else if (argument === '--dir') {
			options.directory = argv[++index];
		} else if (argument === '--list') {
			options.list = argv[++index];
		} else if (argument.startsWith('--')) {
			throw new Error(`Unknown option: ${argument}`);
		} else {
			options.languages.push(argument);
		}
	}

	if (!options.directory) {
		throw new Error('--dir needs a folder');
	}

	if (options.list !== null && !['missing', 'extra', 'identical', 'placeholders'].includes(options.list)) {
		throw new Error('--list takes one of: missing, extra, identical, placeholders');
	}

	return options;
}

/**
 * The language codes that have a catalogue in a folder, the source excluded.
 *
 * @param {string} directory
 * @returns {string[]}
 */
function languagesIn(directory) {
	return readdirSync(directory)
		.filter((file) => file.endsWith('.json'))
		.map((file) => basename(file, '.json'))
		.filter((language) => language !== SOURCE_LANGUAGE)
		.sort();
}

/**
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
function readCatalogue(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function main() {
	const options = parseArguments(process.argv.slice(2));
	const directory = resolve(ROOT, options.directory);
	const languages = options.all ? languagesIn(directory) : options.languages;

	if (languages.length === 0) {
		console.error('Name at least one language (e.g. `zh`), or pass --all.');
		process.exit(2);
	}

	// An unreadable catalogue fails in every mode: the UI cannot load a single string of that language.
	const unreadable = [];
	const readOrRecord = (language) => {
		try {
			return readCatalogue(join(directory, `${language}.json`));
		} catch (error) {
			unreadable.push(`${language}.json: ${error.message}`);
			return null;
		}
	};

	const source = readOrRecord(SOURCE_LANGUAGE);
	const catalogues = languages.map((language) => ({ language, catalogue: readOrRecord(language) }));

	if (source === null || unreadable.length > 0) {
		console.error(`FAILED — a catalogue in ${options.directory} cannot be read:`);
		for (const entry of unreadable) console.error(`  ${entry}`);
		process.exit(1);
	}

	const results = catalogues.map(({ language, catalogue }) => ({
		language,
		result: compareCatalogues(source, catalogue)
	}));

	if (options.json) {
		console.log(
			JSON.stringify(Object.fromEntries(results.map(({ language, result }) => [language, result])), null, 2)
		);
	} else {
		for (const { language, result } of results) {
			console.log(summarize(language, result));

			if (options.list === 'placeholders') {
				for (const { key, expected, actual } of result.placeholderMismatches) {
					console.log(`    ${key}: expected [${expected.join(' ')}], found [${actual.join(' ')}]`);
				}
			} else if (options.list) {
				for (const key of result[options.list]) {
					console.log(`    ${key}`);
				}
			}
		}
	}

	// `--all` reports; only the languages named explicitly are held to parity.
	const failing = options.all ? [] : results.filter(({ result }) => !isComplete(result));

	if (failing.length > 0) {
		console.error(
			`\nIncomplete: ${failing.map(({ language }) => language).join(', ')}. ` +
				'Add the missing keys and keep every placeholder of the English value (see --list missing / placeholders).'
		);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
