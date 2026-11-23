/**
 * Small, dependency-free helpers behind two hints on the email/code form:
 * a "did you mean …?" correction for a mistyped address, and a shortcut that
 * opens the inbox of a well-known webmail provider once the code is sent.
 */

/**
 * Widely used public mail domains that a typo is corrected towards. Only
 * long, distinctive names: a short one (`me.com`) sits within a keystroke or
 * two of many real company domains and would "correct" them.
 */
const TYPO_TARGET_DOMAINS: readonly string[] = [
	'gmail.com',
	'googlemail.com',
	'yahoo.com',
	'hotmail.com',
	'outlook.com',
	'icloud.com',
	'aol.com',
	'protonmail.com',
	'yandex.com'
];

/** Valid public domains that resemble a target but must never be corrected. */
const KNOWN_DOMAINS: readonly string[] = [
	...TYPO_TARGET_DOMAINS,
	'ymail.com',
	'live.com',
	'msn.com',
	'me.com',
	'mac.com',
	'proton.me',
	'pm.me',
	'gmx.com',
	'mail.com',
	'zoho.com'
];

/** Web inboxes of the providers above, keyed by mail domain. */
const WEB_INBOX_URLS: Readonly<Record<string, string>> = {
	'gmail.com': 'https://mail.google.com/mail/u/0/#inbox',
	'googlemail.com': 'https://mail.google.com/mail/u/0/#inbox',
	'yahoo.com': 'https://mail.yahoo.com/',
	'ymail.com': 'https://mail.yahoo.com/',
	'hotmail.com': 'https://outlook.live.com/mail/0/inbox',
	'outlook.com': 'https://outlook.live.com/mail/0/inbox',
	'live.com': 'https://outlook.live.com/mail/0/inbox',
	'msn.com': 'https://outlook.live.com/mail/0/inbox',
	'icloud.com': 'https://www.icloud.com/mail',
	'me.com': 'https://www.icloud.com/mail',
	'mac.com': 'https://www.icloud.com/mail',
	'aol.com': 'https://mail.aol.com/',
	'proton.me': 'https://mail.proton.me/u/0/inbox',
	'protonmail.com': 'https://mail.proton.me/u/0/inbox',
	'pm.me': 'https://mail.proton.me/u/0/inbox'
};

/** Splits an address into local part and lower-cased domain, or null. */
function splitEmail(email: string | null | undefined): { local: string; domain: string } | null {
	const value = (email || '').trim();
	const at = value.lastIndexOf('@');
	if (at < 1 || at === value.length - 1) {
		return null;
	}
	return { local: value.slice(0, at), domain: value.slice(at + 1).toLowerCase() };
}

/**
 * Edit distance where inserting, deleting or replacing a character, or
 * swapping two neighbouring ones (`gmial` → `gmail`), each count as one typo.
 */
function typoDistance(a: string, b: string): number {
	const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
		Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
	);
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			}
		}
	}
	return d[a.length][b.length];
}

/**
 * The corrected address when the domain is a typo or two away from a common
 * mail domain (`name@gmial.com` → `name@gmail.com`); null when the domain is
 * already a known one, unrelated, or the address is incomplete.
 */
export function suggestEmailCorrection(email: string | null | undefined): string | null {
	const parts = splitEmail(email);
	if (!parts || !parts.domain.includes('.') || KNOWN_DOMAINS.includes(parts.domain)) {
		return null;
	}

	let best: string | null = null;
	let bestDistance = Infinity;
	for (const candidate of TYPO_TARGET_DOMAINS) {
		// One typo for the shorter names, two for the long ones.
		const tolerance = candidate.length >= 10 ? 2 : 1;
		const distance = typoDistance(parts.domain, candidate);
		if (distance > 0 && distance <= tolerance && distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	return best ? `${parts.local}@${best}` : null;
}

/** The web inbox for the address's provider, or null for any other domain. */
export function webInboxUrl(email: string | null | undefined): string | null {
	const parts = splitEmail(email);
	return parts ? WEB_INBOX_URLS[parts.domain] ?? null : null;
}
