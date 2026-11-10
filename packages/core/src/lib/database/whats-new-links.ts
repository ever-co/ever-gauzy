// Outside migrations/ on purpose: TypeORM takes every exported function of a migration file as a migration class (see
// `platform-changelog-entry-id.ts`).

/**
 * The learn-more links of the What's New entries Gauzy seeds for the other Ever products that read its `changelog`
 * table (Ever Teams and Ever Platform: `SeedPlatformChangelogContent` and `@gauzy/plugin-changelog`'s
 * `platform-changelog-templates.ts`).
 *
 * The addresses are deployment settings, not code: in this repository only the Ever Platform modules name Ever hosts
 * (the egress audit's `static-hostnames` check), so each entry names a link and the deployment says where it points.
 * An install that sets none (a self-hosted one) gets the entries without links.
 */
export const WHATS_NEW_LINK_SETTINGS = {
	/** The Ever Teams product site. */
	everTeams: 'WHATS_NEW_EVER_TEAMS_URL',
	/** The Ever Teams documentation. */
	everTeamsDocs: 'WHATS_NEW_EVER_TEAMS_DOCS_URL',
	/** The Ever site (Ever ID, the Ever Platform). */
	ever: 'WHATS_NEW_EVER_URL'
} as const;

/** The learn-more link of a seeded entry: one of {@link WHATS_NEW_LINK_SETTINGS}, or none (`''`). */
export type WhatsNewLink = keyof typeof WHATS_NEW_LINK_SETTINGS | '';

/** The longest address a `changelog.learnMoreUrl` holds on every database (a MySQL `varchar`). */
const MAX_URL_LENGTH = 255;

/** An address spelled with its scheme and `//`: `https:example.test` parses as a URL but reads as a relative link. */
const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

/**
 * The address a link's setting holds: an absolute `http(s)` URL (scheme, `//` and a host) of at most 255 characters,
 * as set. Anything else (unset, empty, relative, `https:example.test` without its slashes, another scheme, too long)
 * is no link (`''`), so a mistyped setting never writes a `javascript:`, relative or broken link into the table.
 *
 * @param link - The entry's link.
 * @param env - The settings (the process environment).
 * @returns The address, or `''`.
 */
export function whatsNewLinkUrl(link: WhatsNewLink, env: Record<string, string | undefined> = process.env): string {
	if (!link) {
		return '';
	}
	const value = (env[WHATS_NEW_LINK_SETTINGS[link]] ?? '').trim();
	if (!value || value.length > MAX_URL_LENGTH || !ABSOLUTE_HTTP_URL.test(value)) {
		return '';
	}
	try {
		const { protocol, hostname } = new URL(value);
		return (protocol === 'https:' || protocol === 'http:') && hostname ? value : '';
	} catch {
		return '';
	}
}
