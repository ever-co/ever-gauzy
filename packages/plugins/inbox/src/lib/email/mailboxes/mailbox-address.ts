/** The longest local part an address may have (RFC 5321). */
export const MAX_LOCAL_PART = 64;
/** The longest slug segment allocation makes. */
export const MAX_SEGMENT = 24;

/**
 * A slug segment of a mailbox address: lower-case ASCII letters, digits and dashes (accents folded, everything else a
 * dash), no leading or trailing dash, at most {@link MAX_SEGMENT} characters. Empty when nothing usable remains.
 */
export function slugSegment(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SEGMENT)
		.replace(/-+$/g, '');
}

/** A chosen local part: lower-case, dot-separated slug segments (`support`, `sales.eu`). `null` when not valid. */
export function chosenLocalPart(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim().toLowerCase();
	if (!text || text.length > MAX_LOCAL_PART) return null;
	return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(text) ? text : null;
}

/** A domain as it is stored: lower-case, no trailing dot, labels of letters, digits and dashes. `null` when not valid. */
export function normalizeDomain(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const domain = value.trim().toLowerCase().replace(/\.$/, '');
	if (domain.length > 253) return null;
	return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : null;
}

/** Whether `domain` is `reserved` or one of its subdomains. */
export function isWithinDomain(domain: string, reserved: string | null | undefined): boolean {
	if (!reserved) return false;
	const root = reserved.toLowerCase();
	return domain === root || domain.endsWith(`.${root}`);
}

/**
 * The platform local part of a mailbox (plan 04 §5.1): `<name>.<orgSlug>` — an employee's `<first>.<last>`, a team's
 * slug, an organization mailbox's chosen name — with a numeric suffix on the name for the `attempt`-th collision
 * (`ada.lovelace2.ever`). Answers `null` when the result does not fit a local part.
 */
export function platformLocalPart(name: string, orgSlug: string, attempt = 1): string | null {
	const suffix = attempt > 1 ? String(attempt) : '';
	const room = MAX_LOCAL_PART - orgSlug.length - 1 - suffix.length;
	if (!name || !orgSlug || room < 1) return null;
	const trimmed = name.slice(0, room).replace(/[.-]+$/g, '');
	return chosenLocalPart(`${trimmed}${suffix}.${orgSlug}`);
}

/** An employee's name part: `<first>.<last>` (either alone when the other is missing), else the email's local part. */
export function employeeName(firstName?: string | null, lastName?: string | null, email?: string | null): string {
	const parts = [slugSegment(firstName), slugSegment(lastName)].filter(Boolean);
	if (parts.length > 0) return parts.join('.');
	return slugSegment(String(email ?? '').split('@')[0]) || 'employee';
}
