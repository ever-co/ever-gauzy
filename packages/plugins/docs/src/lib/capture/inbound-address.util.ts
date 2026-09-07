import { DOCS_INBOUND_LOCAL_PART_PATTERN } from '../docs.constants';

/**
 * Pure address parsing and matching for inbound capture.
 *
 * Deliberately free of any entity or ORM import: this is the security-critical half of inbound
 * routing (which tenant receives a message, and whether a sender may write to them), and it must
 * be directly unit-testable. The service that owns persistence delegates here.
 */

/**
 * Normalizes a recipient into the exact string stored in `document_inbound_address.address`.
 *
 * Handles the three shapes a real ESP sends:
 * - a bare address — `docs@acme.com`
 * - a display-name form — `"Docs Intake" <docs@acme.com>`
 * - a tagged address — `docs+invoices@acme.com`, which must resolve to `docs@acme.com`
 *
 * @returns the canonical `local@domain`, or `null` when the input is not a usable address.
 */
export const normalizeRecipientAddress = (recipient?: string): string | null => {
	const raw = String(recipient ?? '')
		.trim()
		.toLowerCase();
	if (!raw.includes('@')) {
		return null;
	}

	// A display-name form carries the real address in angle brackets.
	const angled = /<([^>]+)>/.exec(raw);
	const bare = (angled ? angled[1] : raw).trim();

	// Split on the LAST '@' — a quoted local part may legitimately contain one.
	const atIndex = bare.lastIndexOf('@');
	if (atIndex <= 0 || atIndex === bare.length - 1) {
		return null;
	}

	// Whitespace is checked on the RAW slices, before any tag is stripped. Trimming first would
	// silently turn `docs @acme.com` into `docs@acme.com`, collapsing two distinct inputs onto one
	// stored address — routing must never quietly rewrite the thing it routes on.
	const rawLocal = bare.slice(0, atIndex);
	const domain = bare.slice(atIndex + 1);
	if (!rawLocal || !domain || /\s/.test(rawLocal) || /\s/.test(domain)) {
		return null;
	}

	const local = rawLocal.split('+')[0];
	if (!local) {
		return null;
	}
	return `${local}@${domain}`;
};

/**
 * Validates and lower-cases a domain, label by label.
 *
 * Deliberately strict rather than "contains a dot": this value decides which tenant receives
 * mail, so anything ambiguous is rejected outright.
 *
 * @returns the normalized domain, or `null` when invalid.
 */
export const normalizeInboundDomain = (value?: string): string | null => {
	const domain = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/^@/, '')
		.replace(/\.$/, '');
	if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
		return null;
	}
	return domain;
};

/**
 * Validates and lower-cases a mailbox name.
 *
 * @returns the normalized local part, or `null` when invalid.
 */
export const normalizeInboundLocalPart = (value?: string): string | null => {
	const localPart = String(value ?? '')
		.trim()
		.toLowerCase();
	return DOCS_INBOUND_LOCAL_PART_PATTERN.test(localPart) ? localPart : null;
};

/**
 * Is this sender permitted by this allowlist?
 *
 * An empty or absent allowlist means "any sender that already passed the SPF/DKIM gate" — the
 * documented default. Entries match either a full address (`ceo@acme.com`) or a whole domain,
 * written as `@acme.com` or bare `acme.com`.
 *
 * Domain comparison is exact: `acme.com` does NOT admit `evil-acme.com` or `acme.com.evil.tld`.
 */
export const isSenderAllowedBy = (allowlist: string[] | null | undefined, sender?: string): boolean => {
	if (!allowlist || allowlist.length === 0) {
		return true;
	}

	const normalized = String(sender ?? '')
		.trim()
		.toLowerCase();
	// A non-empty allowlist with no sender to check fails closed.
	const address = normalizeRecipientAddressForSender(normalized);
	if (!address) {
		return false;
	}
	const senderDomain = address.slice(address.lastIndexOf('@') + 1);

	return allowlist.some((entry) => {
		const rule = String(entry ?? '')
			.trim()
			.toLowerCase();
		if (!rule) {
			return false;
		}
		if (rule.startsWith('@')) {
			return senderDomain === rule.slice(1);
		}
		if (!rule.includes('@')) {
			return senderDomain === rule;
		}
		return address === rule;
	});
};

/**
 * Sender-side normalization. Unlike a recipient, a sender's `+tag` is part of their identity and
 * is preserved — stripping it would let `ceo+anything@acme.com` match an allowlist entry for
 * `ceo@acme.com` that the operator never intended.
 */
const normalizeRecipientAddressForSender = (sender: string): string | null => {
	if (!sender.includes('@')) {
		return null;
	}
	const angled = /<([^>]+)>/.exec(sender);
	const bare = (angled ? angled[1] : sender).trim();
	const atIndex = bare.lastIndexOf('@');
	if (atIndex <= 0 || atIndex === bare.length - 1) {
		return null;
	}
	const local = bare.slice(0, atIndex).trim();
	const domain = bare.slice(atIndex + 1).trim();
	if (!local || !domain || /\s/.test(local) || /\s/.test(domain)) {
		return null;
	}
	return `${local}@${domain}`;
};
