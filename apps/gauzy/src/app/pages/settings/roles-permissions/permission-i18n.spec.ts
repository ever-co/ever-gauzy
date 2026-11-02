import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PermissionGroups, PermissionsEnum } from '@gauzy/contracts';
import {
	ADMINISTRATION_PERMISSION_SECTIONS,
	GENERAL_PERMISSION_SECTIONS,
	IPermissionSection,
	OTHER_PERMISSION_SECTION,
	toPermissionSections
} from './permission-sections';

/**
 * Guards the labels of Settings → Roles & Permissions.
 *
 * The page renders `'ORGANIZATIONS_PAGE.PERMISSIONS.' + permission | translate` for every member of
 * `PermissionGroups` and `'ORGANIZATIONS_PAGE.PERMISSIONS.SECTIONS.' + section.key` for every section
 * title. The app's missing-translation handler returns the key verbatim, so a permission added to the
 * contracts without a label does not fail anywhere: it renders as the raw key, in the catch-all
 * "Other" section, and its toggle toast names the raw key too. That is how 174 commerce permissions
 * shipped unlabelled; this spec makes the same omission fail in CI.
 */

const I18N_DIR = join(__dirname, '../../../../../../../packages/ui-core/i18n/assets/i18n');

type Dictionary = Record<string, unknown>;

function loadLanguages(): Map<string, Dictionary> {
	let languages = new Map<string, Dictionary>();
	for (const file of readdirSync(I18N_DIR)
		.filter((name) => name.endsWith('.json'))
		.sort()) {
		languages.set(file.replace(/\.json$/, ''), JSON.parse(readFileSync(join(I18N_DIR, file), 'utf8')));
	}
	return languages;
}

function permissionsNamespace(dictionary: Dictionary): Dictionary {
	return ((dictionary['ORGANIZATIONS_PAGE'] as Dictionary)?.['PERMISSIONS'] ?? {}) as Dictionary;
}

function hasLabel(namespace: Dictionary, key: string): boolean {
	const value = namespace[key];
	return typeof value === 'string' && value.trim().length > 0;
}

const GROUPS: Array<[keyof typeof PermissionGroups, IPermissionSection[]]> = [
	['GENERAL', GENERAL_PERMISSION_SECTIONS],
	['ADMINISTRATION', ADMINISTRATION_PERMISSION_SECTIONS]
];

/** Every permission that sits in a commerce section, across both groups. */
function commercePermissions(): PermissionsEnum[] {
	return GROUPS.flatMap(([, sections]) =>
		sections.filter((section) => section.key.startsWith('COMMERCE_')).flatMap((section) => section.permissions)
	);
}

describe('Roles & Permissions labels', () => {
	const languages = loadLanguages();
	const en = permissionsNamespace(languages.get('en') ?? {});

	it('reads all 14 language files (guards against a broken path)', () => {
		expect([...languages.keys()]).toEqual([
			'ach',
			'ar',
			'bg',
			'de',
			'en',
			'es',
			'fr',
			'he',
			'it',
			'nl',
			'pl',
			'pt',
			'ru',
			'zh'
		]);
		expect(Object.keys(en).length).toBeGreaterThan(100);
	});

	it('labels every PermissionGroups member in en.json', () => {
		const missing = [...PermissionGroups.GENERAL, ...PermissionGroups.ADMINISTRATION].filter(
			(permission) => !hasLabel(en, permission)
		);
		expect(missing).toEqual([]);
	});

	it('labels every PermissionsEnum value in en.json, grouped or not (Q8c)', () => {
		// A value outside PermissionGroups is not toggled on this page, but it is still named elsewhere — the
		// "insufficient permissions" message lists the missing ones — and English is every language's fallback.
		const missing = Object.values(PermissionsEnum).filter((permission) => !hasLabel(en, permission));
		expect(missing).toEqual([]);
	});

	it.each([...languages.keys()])('%s.json holds no empty permission label (Q8c)', (language) => {
		// An empty string is a translation as far as ngx-translate is concerned: it shadows the English fallback,
		// so the toggle renders with no label at all — worse than a missing key.
		const namespace = permissionsNamespace(languages.get(language) ?? {});
		const empty = Object.entries(namespace)
			.filter(([, value]) => typeof value === 'string' && value.trim().length === 0)
			.map(([key]) => key);
		expect(empty).toEqual([]);
	});

	it.each(GROUPS)('places every %s permission in a titled section, none in "Other"', (group, sections) => {
		const other = toPermissionSections(PermissionGroups[group], sections).find(
			(section) => section.key === OTHER_PERMISSION_SECTION
		);
		expect(other?.permissions ?? []).toEqual([]);
	});

	it.each(GROUPS)('lists only PermissionGroups members in the %s sections', (_group, sections) => {
		// The commerce sections are shared by both lists (see COMMERCE_PERMISSION_SECTIONS), so a value
		// may sit in a section of the other group's list; it must still be a member of SOME group, or
		// it is a typo that no list would ever render.
		const members = new Set<PermissionsEnum>([...PermissionGroups.GENERAL, ...PermissionGroups.ADMINISTRATION]);
		const strays = sections
			.flatMap((section) => section.permissions)
			.filter((permission) => !members.has(permission));
		expect(strays).toEqual([]);
	});

	it('groups the commerce permissions into commerce sections', () => {
		expect(commercePermissions().length).toBeGreaterThanOrEqual(174);
	});

	/**
	 * #3912 — the line under each toggle says what the permission lets a role do, from
	 * `ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.<permission value>`. A permission added to the groups without
	 * one shows no line at all, so this is where the omission fails instead.
	 */
	describe('descriptions (#3912)', () => {
		const pagePermissions = [...new Set([...PermissionGroups.GENERAL, ...PermissionGroups.ADMINISTRATION])];
		const permissionValues = new Set<string>(Object.values(PermissionsEnum));
		const descriptionsOf = (language: string) =>
			(permissionsNamespace(languages.get(language) ?? {})['DESCRIPTIONS'] ?? {}) as Dictionary;

		it('describes every permission the page lists in en.json', () => {
			const descriptions = descriptionsOf('en');
			expect(pagePermissions.filter((permission) => !hasLabel(descriptions, permission))).toEqual([]);
		});

		it.each([...languages.keys()])('%s.json describes every listed permission, with no empty text', (language) => {
			// Every language carries them (English is only the fallback for a key a language lacks), and an empty
			// string would shadow that fallback with a blank line
			const descriptions = descriptionsOf(language);
			expect(pagePermissions.filter((permission) => !hasLabel(descriptions, permission))).toEqual([]);
		});

		it.each([...languages.keys()])('%s.json keys descriptions by permission values only', (language) => {
			// A key that is no permission value is a typo (or a member name, like APPROVAL_POLICY_VIEW for the
			// value APPROVALS_POLICY_VIEW) that no toggle would ever show
			const strays = Object.keys(descriptionsOf(language)).filter((key) => !permissionValues.has(key));
			expect(strays).toEqual([]);
		});

		it('does not repeat the label as the description', () => {
			// The page once printed each label twice; a description must add something the label does not say
			const descriptions = descriptionsOf('en');
			const repeats = pagePermissions.filter(
				(permission) =>
					String(descriptions[permission]).trim().toLowerCase() === String(en[permission]).trim().toLowerCase()
			);
			expect(repeats).toEqual([]);
		});
	});

	it.each([...languages.keys()])('%s.json titles every section and labels every commerce permission', (language) => {
		const namespace = permissionsNamespace(languages.get(language) ?? {});
		const sections = (namespace['SECTIONS'] ?? {}) as Dictionary;
		const sectionKeys = [
			...new Set([...GROUPS.flatMap(([, list]) => list.map((section) => section.key)), OTHER_PERMISSION_SECTION])
		];
		expect(sectionKeys.filter((key) => !hasLabel(sections, key))).toEqual([]);
		expect(commercePermissions().filter((permission) => !hasLabel(namespace, permission))).toEqual([]);
	});
});
