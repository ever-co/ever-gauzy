import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
	ActionTypeEnum,
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentShareAccessEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum
} from '@gauzy/contracts';
// Namespace import on purpose: the workspace sets `esModuleInterop: false`, so under
// the CommonJS emit Jest uses, a *default* JSON import compiles to `require(…).default`
// and evaluates to `undefined`. `docs-ui.plugin.ts` can default-import the same file
// because the library build goes through the bundler's JSON loader instead.
import * as en from '../../i18n/en.json';
import { DOCS_LINK_ENTITIES } from '../models/docs-link.model';

/**
 * Guards the `DOCS` translation namespace against the two ways it silently rots:
 *
 * 1. a template references `DOCS.SOMETHING` that was never added to `en.json`
 *    (ngx-translate renders the raw key, so it only shows up as ugly UI); and
 * 2. a key is built at runtime from an enum whose wire value does not match the
 *    JSON key — `DocumentReviewReasonEnum` in particular stores kebab-case
 *    (`low-confidence`) while the namespace is SCREAMING_SNAKE (`LOW_CONFIDENCE`),
 *    so every call site must normalise before it interpolates.
 *
 * `en.json` IS the namespace body — `docs-ui.plugin.ts` registers it under
 * `translationNamespace: 'DOCS'` — so a `DOCS.a.b` key resolves to `en.a.b`.
 */

const SRC_ROOT = join(__dirname, '..', '..');

/** `DOCS.` followed by dot-separated SCREAMING_SNAKE segments, not preceded by a word char or dot. */
const KEY_PATTERN = /(?<![\w.])DOCS\.[A-Z0-9_]+(?:\.[A-Z0-9_]+)*/g;

/**
 * Prefixes that are legitimately interpolated at runtime (`'DOCS.STATUS.' + status`)
 * or written as `DOCS.X.*` in a doc comment. A static scan sees the bare prefix and
 * resolves it to an object rather than a string; the suffixes are covered by the
 * enum-driven expectations below instead.
 */
const DYNAMIC_PREFIXES = new Set([
	'DOCS.KIND',
	'DOCS.STATUS',
	'DOCS.KNOWLEDGE',
	'DOCS.SOURCE',
	'DOCS.VISIBILITY',
	'DOCS.SHARE.ACCESS',
	'DOCS.REVIEW.REASONS',
	'DOCS.LINKS.ENTITY',
	'DOCS.EDITOR.SLASH',
	// `actionLabelKeyOf()` builds `DOCS.ACTIVITY.ACTION.${action.toUpperCase()}`; the suffixes are
	// covered by the `ActionTypeEnum` expectation below.
	'DOCS.ACTIVITY.ACTION',
	// `DOCS_ACTIVITY_VALUE_KEY_PREFIXES` interpolates a `reviewStatus` value onto `DOCS.REVIEW.`.
	// Deliberately NOT enum-asserted: `DocumentReviewStatusEnum.NONE` has no label, and
	// `translateOrRaw()` is specified to render the raw enum for exactly that case.
	'DOCS.REVIEW'
]);

function collectSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) return collectSourceFiles(full);
		if (!/\.(ts|html)$/.test(entry.name)) return [];
		if (/\.spec\.ts$/.test(entry.name)) return [];
		return [full];
	});
}

/** Resolves a full `DOCS.a.b` key against the namespace body, or `undefined`. */
function resolveKey(key: string): unknown {
	return key
		.slice('DOCS.'.length)
		.split('.')
		.reduce<unknown>(
			(node, segment) =>
				node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
			en as unknown
		);
}

/** The normalisation every runtime call site must apply to a review reason. */
function reviewReasonKeySegment(reason: string): string {
	return reason.toUpperCase().split('-').join('_');
}

describe('DOCS i18n namespace', () => {
	const referencedKeys = new Map<string, Set<string>>();

	beforeAll(() => {
		for (const file of collectSourceFiles(SRC_ROOT)) {
			const contents = readFileSync(file, 'utf8');
			for (const match of contents.matchAll(KEY_PATTERN)) {
				const key = match[0];
				// Doc comments name key families with a wildcard (`DOCS.LINKS.ENTITY.*`,
				// `DOCS.EDITOR.SLASH.GROUP_*`). Those are prose, not references.
				const trailer = contents.slice((match.index ?? 0) + key.length, (match.index ?? 0) + key.length + 2);
				if (trailer.startsWith('*') || trailer.startsWith('.*')) continue;
				if (!referencedKeys.has(key)) referencedKeys.set(key, new Set());
				referencedKeys.get(key)?.add(file);
			}
		}
	});

	it('scans a non-trivial number of source files (guards against a broken walk)', () => {
		expect(existsSync(SRC_ROOT)).toBe(true);
		expect(collectSourceFiles(SRC_ROOT).length).toBeGreaterThan(50);
		expect(referencedKeys.size).toBeGreaterThan(100);
	});

	it('resolves every statically referenced key to a translated string', () => {
		const unresolved: string[] = [];
		for (const [key, files] of referencedKeys) {
			if (DYNAMIC_PREFIXES.has(key)) continue;
			const value = resolveKey(key);
			if (typeof value !== 'string') {
				unresolved.push(`${key} (${value === undefined ? 'missing' : 'not a leaf'}) <- ${[...files].join(', ')}`);
			}
		}
		expect(unresolved).toEqual([]);
	});

	it.each([
		['DOCS.KIND', Object.values(DocumentKindEnum)],
		['DOCS.STATUS', Object.values(DocumentStatusEnum)],
		['DOCS.KNOWLEDGE', Object.values(DocumentKnowledgeStatusEnum)],
		['DOCS.SOURCE', Object.values(DocumentSourceEnum)],
		['DOCS.VISIBILITY', Object.values(DocumentVisibilityEnum)],
		['DOCS.SHARE.ACCESS', Object.values(DocumentShareAccessEnum)]
	])('translates every enum value interpolated under %s', (prefix, values) => {
		for (const value of values) {
			expect(typeof resolveKey(`${prefix}.${value}`)).toBe('string');
		}
	});

	it('translates every activity action once the stored value is upper-cased', () => {
		for (const action of Object.values(ActionTypeEnum)) {
			// `actionLabelKeyOf()` upper-cases the stored PascalCase value ('Created' → 'CREATED').
			expect(typeof resolveKey(`DOCS.ACTIVITY.ACTION.${action.toUpperCase()}`)).toBe('string');
		}
	});

	it('translates every review reason once the kebab-case wire value is normalised', () => {
		for (const reason of Object.values(DocumentReviewReasonEnum)) {
			// The raw wire value must NOT be used directly — that is the bug this guards.
			expect(typeof resolveKey(`DOCS.REVIEW.REASONS.${reviewReasonKeySegment(reason)}`)).toBe('string');
		}
	});

	it('translates the label of every link entity offered by the picker', () => {
		for (const descriptor of DOCS_LINK_ENTITIES) {
			expect(typeof resolveKey(descriptor.labelKey)).toBe('string');
		}
	});
});
