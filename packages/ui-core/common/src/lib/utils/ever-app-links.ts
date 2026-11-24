import type { IEverApp } from '../constants/ever-apps.constants';

/**
 * `EVER_APP_LINKS`: where this deployment's app switcher sends people for each Ever app, as `id=url` pairs separated
 * by commas, for example `platform=https://platform.example.com,works=https://works.example.com` (the format Ever
 * Teams reads from `NEXT_PUBLIC_EVER_APP_LINKS`). The ids are those of the catalog (`platform`, `works`, `teams`,
 * `gauzy`, `demand`, `rec`, `traduora`).
 *
 * Each valid pair replaces the address (and the domain shown under the name) of the app with that id; every other
 * app keeps the catalog's address, so with the setting unset the switcher is exactly the catalog. A pair is ignored
 * when it has no `=`, an empty id, or a link that is not an absolute http(s) URL without credentials. When an id
 * is given twice, the last pair wins.
 *
 * @param raw - The setting, as the environment carries it (empty or unset: no links).
 * @returns The links by app id.
 */
export function parseEverAppLinks(raw: string | null | undefined): Map<string, URL> {
	const links = new Map<string, URL>();
	for (const entry of String(raw ?? '').split(',')) {
		const separator = entry.indexOf('=');
		if (separator <= 0) {
			continue;
		}
		const id = entry.slice(0, separator).trim();
		const url = httpUrl(entry.slice(separator + 1).trim());
		if (id && url) {
			links.set(id, url);
		}
	}
	return links;
}

/**
 * The catalog with this deployment's addresses (`EVER_APP_LINKS`, see {@link parseEverAppLinks}) in place of the
 * catalog's for the apps it names. The order, names and logos stay the catalog's; nothing is added or removed.
 *
 * @param apps - The Ever apps the switcher lists (the catalog).
 * @param raw - The `EVER_APP_LINKS` setting.
 * @param keep - Ids the setting never changes: the current app, whose row shows this deployment's own address.
 * @returns The apps, each with this deployment's address when the setting gives one.
 */
export function withEverAppLinks(
	apps: ReadonlyArray<IEverApp>,
	raw: string | null | undefined,
	keep: ReadonlyArray<string> = []
): ReadonlyArray<IEverApp> {
	const links = parseEverAppLinks(raw);
	for (const id of keep) {
		links.delete(id);
	}
	if (links.size === 0) {
		return apps;
	}
	return apps.map((app) => {
		const link = links.get(app.id);
		return link ? { ...app, url: link.href, domain: link.host } : app;
	});
}

/** `value` as an absolute http(s) URL without credentials, or `null`. */
function httpUrl(value: string): URL | null {
	if (!value) {
		return null;
	}
	try {
		const url = new URL(value);
		const isHttp = url.protocol === 'https:' || url.protocol === 'http:';
		return isHttp && url.host && !url.username && !url.password ? url : null;
	} catch {
		return null;
	}
}
