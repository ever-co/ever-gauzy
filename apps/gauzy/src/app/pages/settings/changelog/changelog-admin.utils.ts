import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { IChangelog, IChangelogCreateInput } from '@gauzy/contracts';

/** Where the page's translations live. */
export const CHANGELOG_ADMIN_I18N = 'CHANGELOG_MENU.MANAGE';

/**
 * The longest text a field takes. The changelog columns are plain `varchar`s, which MySQL sizes at 255:
 * a longer value would save on PostgreSQL and SQLite and fail on MySQL.
 */
export const CHANGELOG_FIELD_MAX_LENGTH = 255;

/** The icon a new entry starts with. Any Eva icon name works, as on the seeded entries. */
export const CHANGELOG_DEFAULT_ICON = 'star-outline';

/** The entry form's value. The date is the `YYYY-MM-DD` of a date input. */
export interface IChangelogFormValue {
	title: string;
	icon: string;
	date: string;
	content: string;
	learnMoreUrl: string;
	imageUrl: string;
	isFeature: boolean;
}

/** A link spelled out in full: the scheme, both slashes, then the host. */
const FULL_HTTP_URL = /^https?:\/\/[^\s/?#]/i;

/**
 * Whether `value` is a full http(s) address: the only links the What's New cards open. The address must
 * spell out `http://` or `https://` and a host, not only parse as one: `https:example.com` parses, but a
 * browser reads it relative to the page it is on.
 */
export function isHttpUrl(value: string | null | undefined): boolean {
	if (!value || !FULL_HTTP_URL.test(value)) {
		return false;
	}
	try {
		const url = new URL(value);
		return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
	} catch {
		return false;
	}
}

/** An optional link: empty, or a full http(s) address (no `javascript:` or relative links on the sign-in page). */
export const httpUrlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
	const value = typeof control.value === 'string' ? control.value.trim() : control.value;
	return !value || isHttpUrl(value) ? null : { httpUrl: true };
};

/**
 * An image bundled with the web app, named by its path under `assets/`, as the seeded sign-up features name
 * theirs (`assets/images/features/macbook-1.png`). Folder names carry no dots, so the path cannot climb out
 * of `assets/`, and it cannot start with `//` (another host).
 */
const BUNDLED_IMAGE = /^\/?assets\/(?:[\w-]+\/)*[\w-]+(?:\.[\w-]+)+$/;

/** Whether `value` is an image a card may show: a full http(s) address, or an image bundled with the app. */
export function isImageUrl(value: string | null | undefined): boolean {
	return isHttpUrl(value) || (!!value && BUNDLED_IMAGE.test(value));
}

/**
 * An optional image: empty, a full http(s) address, or an image bundled with the app (so a seeded sign-up
 * feature can be edited without replacing its picture). Links the cards open stay http(s) only.
 */
export const imageUrlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
	const value = typeof control.value === 'string' ? control.value.trim() : control.value;
	return !value || isImageUrl(value) ? null : { httpUrl: true };
};

/** A required text: something other than spaces, since the text is saved trimmed. */
export const requiredTextValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
	typeof control.value === 'string' && control.value.trim() ? null : { required: true };

/**
 * An icon the app can draw: the cards show the icon by name, and a name no icon pack holds draws nothing.
 *
 * @param isKnownIcon Whether an icon of that name is registered.
 */
export function knownIconValidator(isKnownIcon: (name: string) => boolean): ValidatorFn {
	return (control: AbstractControl): ValidationErrors | null => {
		const name = typeof control.value === 'string' ? control.value.trim() : '';
		return !name || isKnownIcon(name) ? null : { unknownIcon: true };
	};
}

/**
 * A stored date as the day a date input shows: `2026-08-05T00:00:00.000Z` → `2026-08-05`. Entries are dated
 * at midnight UTC, so the day is read in UTC (in local time it would be the day before west of Greenwich).
 */
export function toDateInputValue(date: Date | string | null | undefined): string {
	if (!date) {
		return '';
	}
	const parsed = new Date(date);
	return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

/** Today as the user's calendar shows it, as a date input takes it. */
function toLocalDateInputValue(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** An entry as the form starts with it: the entry's own values, or a new entry's dated today. */
export function toChangelogFormValue(
	entry: IChangelog | null | undefined,
	today: Date = new Date()
): IChangelogFormValue {
	return {
		title: entry?.title || '',
		icon: entry?.icon || CHANGELOG_DEFAULT_ICON,
		date: entry?.date ? toDateInputValue(entry.date) : toLocalDateInputValue(today),
		content: entry?.content || '',
		learnMoreUrl: entry?.learnMoreUrl || '',
		imageUrl: entry?.imageUrl || '',
		isFeature: !!entry?.isFeature
	};
}

/**
 * The form's value as the API saves it: text trimmed, and the day at midnight UTC, as the seeded entries are
 * dated. Every field is sent, an emptied link as an empty string: the API saves the entry whole, and the
 * cards treat an empty link as none.
 */
export function toChangelogInput(value: IChangelogFormValue): IChangelogCreateInput {
	return {
		title: (value.title || '').trim(),
		icon: (value.icon || '').trim() || CHANGELOG_DEFAULT_ICON,
		date: new Date(`${value.date}T00:00:00.000Z`),
		content: (value.content || '').trim(),
		learnMoreUrl: (value.learnMoreUrl || '').trim(),
		imageUrl: (value.imageUrl || '').trim(),
		isFeature: !!value.isFeature
	};
}

/**
 * The entry as the What's New card would show the form's value while it is being typed: no date until one is
 * picked (the date pipe throws on an invalid date), the default icon until the name is one the app can draw,
 * and no link or image until it is a full http(s) address.
 *
 * @param value The form's value.
 * @param isKnownIcon Whether an icon of that name is registered.
 */
export function toChangelogPreview(
	value: IChangelogFormValue,
	isKnownIcon: (name: string) => boolean = () => true
): IChangelog {
	const input = toChangelogInput(value);
	return {
		...input,
		icon: isKnownIcon(input.icon) ? input.icon : CHANGELOG_DEFAULT_ICON,
		date: value.date && !isNaN(input.date.getTime()) ? input.date : undefined,
		learnMoreUrl: isHttpUrl(input.learnMoreUrl) ? input.learnMoreUrl : '',
		imageUrl: isImageUrl(input.imageUrl) ? input.imageUrl : ''
	};
}

/** The API refused the change: the user is not the installation's operator. */
export function isForbidden(error: unknown): boolean {
	return (error as { status?: number })?.status === 403;
}

/** Entries newest first, as the What's New panel shows them. */
export function sortChangelogEntries(entries: IChangelog[]): IChangelog[] {
	return [...(entries || [])].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}
