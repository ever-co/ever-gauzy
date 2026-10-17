// cspell:ignore antw Antw
/** A recipient address as a mailbox is looked up by. */
export interface INormalizedAddress {
	/** Lower-case, without angle brackets and without the `+tag` of the local part. */
	address: string;
	/** The `+tag` sub-address, when there was one (kept in the message's metadata). */
	tag?: string;
}

/** The longest address RFC 5321 allows (a mailbox address column holds this). */
export const MAX_ADDRESS_LENGTH = 320;

const ADDRESS_PATTERN = /^[^\s@<>()[\],;:"\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Normalizes an address for the mailbox lookup: `"Ada <Ada+billing@Acme.Test>"` → `{ address: 'ada@acme.test',
 * tag: 'billing' }`. Anything that is not a plain address answers `null` (it can be no mailbox).
 */
export function normalizeAddress(raw: unknown): INormalizedAddress | null {
	if (typeof raw !== 'string') return null;
	let text = raw.trim();
	const bracket = /<([^<>]+)>\s*$/.exec(text);
	if (bracket) text = (bracket[1] as string).trim();
	text = text.toLowerCase();
	if (text.length > MAX_ADDRESS_LENGTH) return null;
	const at = text.lastIndexOf('@');
	if (at <= 0) return null;
	let local = text.slice(0, at);
	const domain = text.slice(at + 1);
	let tag: string | undefined;
	const plus = local.indexOf('+');
	if (plus > 0) {
		tag = local.slice(plus + 1) || undefined;
		local = local.slice(0, plus);
	}
	const address = `${local}@${domain}`;
	if (!ADDRESS_PATTERN.test(address)) return null;
	return tag ? { address, tag } : { address };
}

/** The distinct normalized addresses of a list, in order. */
export function normalizeAddresses(raw: unknown[]): INormalizedAddress[] {
	const seen = new Set<string>();
	const out: INormalizedAddress[] = [];
	for (const value of raw) {
		const normalized = normalizeAddress(value);
		if (normalized && !seen.has(normalized.address)) {
			seen.add(normalized.address);
			out.push(normalized);
		}
	}
	return out;
}

/** Reply / forward prefixes of the common mail clients (`Re:`, `RE[2]:`, `Fwd:`, `AW:`, `SV:`, `VS:`, `Antw:`). */
const SUBJECT_PREFIX = /^\s*((re|fwd|fw|aw|wg|sv|vs|antw|tr|rif)\s*(\[\d+\]|\(\d+\))?\s*:\s*)+/i;

/** A subject as threads are matched by: without reply / forward prefixes, lower-case, single spaces, ≤ 300. */
export function normalizeSubject(subject: unknown): string {
	if (typeof subject !== 'string') return '';
	// Stacked prefixes ("Re: Fwd: Re: hello") go in one pass: the pattern repeats.
	return subject.replace(SUBJECT_PREFIX, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 300);
}

/**
 * Whether a sender passes a mailbox's allowlist: an empty list allows anyone; an entry is an address or `@domain`
 * (which also matches its subdomains).
 */
export function isSenderAllowed(allowlist: string[], sender: string | undefined): boolean {
	if (allowlist.length === 0) return true;
	const from = normalizeAddress(sender ?? '');
	if (!from) return false;
	const domain = from.address.slice(from.address.lastIndexOf('@') + 1);
	return allowlist.some((entry) => {
		const rule = entry.trim().toLowerCase();
		if (!rule) return false;
		if (rule.startsWith('@')) {
			const allowed = rule.slice(1);
			return domain === allowed || domain.endsWith(`.${allowed}`);
		}
		return normalizeAddress(rule)?.address === from.address;
	});
}
