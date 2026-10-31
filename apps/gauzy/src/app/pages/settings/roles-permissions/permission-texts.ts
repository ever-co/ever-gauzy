import { PermissionsEnum } from '@gauzy/contracts';

/**
 * The translated texts of Settings → Roles & Permissions.
 *
 * Each permission has a label, `ORGANIZATIONS_PAGE.PERMISSIONS.<permission>`, and a one-line description of
 * what it lets a role do, `ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.<permission>`. Both are keyed by the
 * permission's value (the string stored on the role), not by its enum member name: they differ for
 * `APPROVAL_POLICY_*`, whose values are `APPROVALS_POLICY_*`.
 */
export const PERMISSION_LABEL_PREFIX = 'ORGANIZATIONS_PAGE.PERMISSIONS.';
export const PERMISSION_DESCRIPTION_PREFIX = 'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.';

/** What the page shows for one permission, in the active language. */
export interface IPermissionTexts {
	label?: string;
	/** Absent when the catalogue has no description for the permission. */
	description?: string;
}

/** The translation key of a permission's label. */
export function permissionLabelKey(permission: PermissionsEnum | string): string {
	return PERMISSION_LABEL_PREFIX + permission;
}

/** The translation key of a permission's description. */
export function permissionDescriptionKey(permission: PermissionsEnum | string): string {
	return PERMISSION_DESCRIPTION_PREFIX + permission;
}

/** Every key the page needs translated for the given permissions: each label, then each description. */
export function permissionTextKeys(permissions: readonly PermissionsEnum[]): string[] {
	return [...permissions.map(permissionLabelKey), ...permissions.map(permissionDescriptionKey)];
}

/**
 * A translation, or `undefined` when the catalogue has none. The app's missing-translation handler answers a
 * missing key with the key itself, which must never reach the screen as if it were text.
 */
function translated(translations: Record<string, unknown>, key: string): string | undefined {
	const value = translations?.[key];
	return typeof value === 'string' && value.trim().length > 0 && value !== key ? value : undefined;
}

/**
 * The label and description of each permission, read from one lookup of {@link permissionTextKeys} (the object
 * `TranslateService.get`/`stream` answers for an array of keys).
 *
 * @param permissions The permissions the page lists.
 * @param translations Key → translated text, in the active language with the English fallback applied.
 * @returns A map with one entry per permission; a text the catalogue lacks is left out of the entry.
 */
export function toPermissionTexts(
	permissions: readonly PermissionsEnum[],
	translations: Record<string, unknown>
): Map<PermissionsEnum, IPermissionTexts> {
	return new Map(
		permissions.map((permission) => [
			permission,
			{
				label: translated(translations, permissionLabelKey(permission)),
				description: translated(translations, permissionDescriptionKey(permission))
			}
		])
	);
}

/**
 * Whether a permission matches the search box: its code read as words (`ORG_TASK_VIEW` → "org task view"), as
 * the search always matched, or its label or description in the active language.
 *
 * @param permission The permission value.
 * @param term What the user typed; an empty term matches everything.
 * @param texts The permission's translated texts, when they are loaded.
 */
export function matchesPermissionSearch(
	permission: PermissionsEnum | string,
	term: string | null | undefined,
	texts?: IPermissionTexts
): boolean {
	const needle = (term ?? '').trim().toLowerCase();
	if (!needle) return true;

	return [permission.replace(/_/g, ' '), texts?.label, texts?.description].some(
		(haystack) => !!haystack && haystack.toLowerCase().includes(needle)
	);
}
