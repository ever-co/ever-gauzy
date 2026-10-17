import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getValue } from '@ngx-translate/core';
import * as ts from 'typescript';
import { FeatureToggleComponent } from './feature-toggle.component';

/**
 * Guards the labels of Settings → Features for the commerce feature catalogue.
 *
 * The feature-toggle card builds its keys from the stored row, not from a constant:
 *
 *   title       getTranslationFormat('SETTINGS_FEATURES.' + name)
 *   description getTranslationFormat('SETTINGS_FEATURES_DESCRIPTION.' + name + '.' + description)
 *
 * and the app's missing-translation handler returns the key verbatim, so a catalogue entry without a
 * matching dictionary entry renders as `SETTINGS_FEATURES.ORDERS` and nothing fails. The keys are
 * computed here with the component's own `getTranslationFormat` and resolved with ngx-translate's own
 * `getValue`, so a description ending in `.` (resolved as a key ending in `.`) is checked the way the
 * pipe resolves it, not the way it reads.
 *
 * The catalogue (`packages/core/src/lib/feature/commerce-feature-catalogue.ts`) belongs to the API and
 * the Nx boundary rule does not let a UI library import it, so it is read from source and transpiled
 * here. It has no imports by design (both seed paths read it); if it ever gains one, the loader below
 * throws and names it rather than silently checking nothing.
 */

const ROOT = join(__dirname, '../../../../../..');
const I18N_DIR = join(ROOT, 'packages/ui-core/i18n/assets/i18n');
const CATALOGUE_FILE = join(ROOT, 'packages/core/src/lib/feature/commerce-feature-catalogue.ts');

interface ICatalogueEntry {
	name: string;
	code: string;
	description: string;
}

function loadCatalogue(): ICatalogueEntry[] {
	const { outputText } = ts.transpileModule(readFileSync(CATALOGUE_FILE, 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
	});
	let exported: { COMMERCE_CATALOGUE?: ICatalogueEntry[] } = {};
	const requireNothing = (specifier: string) => {
		throw new Error(`commerce-feature-catalogue.ts now imports '${specifier}'; load it another way`);
	};
	new Function('exports', 'require', outputText)(exported, requireNothing);
	return exported.COMMERCE_CATALOGUE ?? [];
}

function loadLanguages(): Map<string, Record<string, unknown>> {
	let languages = new Map<string, Record<string, unknown>>();
	for (const file of readdirSync(I18N_DIR)
		.filter((name) => name.endsWith('.json'))
		.sort()) {
		languages.set(file.replace(/\.json$/, ''), JSON.parse(readFileSync(join(I18N_DIR, file), 'utf8')));
	}
	return languages;
}

const format = (text: string): string => FeatureToggleComponent.prototype.getTranslationFormat.call(null, text);

function keysOf(entry: ICatalogueEntry): string[] {
	return [
		format('SETTINGS_FEATURES.' + entry.name),
		format('SETTINGS_FEATURES_DESCRIPTION' + '.' + entry.name + '.' + entry.description)
	];
}

describe('Settings → Features labels for the commerce catalogue', () => {
	const catalogue = loadCatalogue();
	const languages = loadLanguages();

	it('reads the catalogue and all 14 language files (guards against a broken path)', () => {
		expect(catalogue.length).toBe(33);
		expect(languages.size).toBe(14);
	});

	it.each([...languages.keys()])('%s.json has a title and a description for every catalogue entry', (language) => {
		const dictionary = languages.get(language);
		const missing = catalogue.flatMap(keysOf).filter((key) => {
			const value = getValue(dictionary, key);
			return typeof value !== 'string' || value.trim().length === 0;
		});
		expect(missing).toEqual([]);
	});
});

/**
 * Q8c: an empty string is a translation as far as ngx-translate is concerned — it shadows the English fallback — so a
 * feature card, description or sub-feature row whose label is `""` renders with no text at all. pt.json carried one
 * (`SETTINGS_FEATURES_TEXT.EMAIL_HISTORY.CUSTOM_EMAIL_TEMPLATE`). The `"": ""` members are the files' placeholders for
 * a feature without sub-features and are not labels.
 */
describe('Settings → Features labels are never empty', () => {
	const languages = loadLanguages();
	const NAMESPACES = ['SETTINGS_FEATURES', 'SETTINGS_FEATURES_DESCRIPTION', 'SETTINGS_FEATURES_TEXT'];

	function emptyLabels(node: unknown, path: string): string[] {
		if (typeof node === 'string') {
			return node.trim().length === 0 ? [path] : [];
		}
		if (!node || typeof node !== 'object') {
			return [];
		}
		return Object.entries(node as Record<string, unknown>)
			.filter(([key]) => key !== '')
			.flatMap(([key, value]) => emptyLabels(value, `${path}.${key}`));
	}

	it.each([...languages.keys()])('%s.json holds no empty feature label', (language) => {
		const dictionary = languages.get(language) ?? {};
		const empty = NAMESPACES.flatMap((namespace) => emptyLabels(dictionary[namespace], namespace));
		expect(empty).toEqual([]);
	});
});
