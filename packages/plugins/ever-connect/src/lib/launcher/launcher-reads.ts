import { Inject, Injectable, Optional } from '@nestjs/common';
import type { EverConnectConfig } from '../ever-connect-config';
import {
	EVER_CONNECT_CLOCK,
	EVER_CONNECT_FETCH,
	EVER_CONNECT_SETTINGS,
	MODULE_VERSION
} from '../ever-connect.constants';
import { CONSTANTS } from '../sdk';
import { EVER_CONNECT_LAUNCHER_SETTINGS, LauncherConfig } from './launcher-config';
import {
	AppLauncherEnvironment,
	AppLauncherPlatformsResponse,
	isLauncherItem,
	LauncherApp,
	LauncherInstall,
	launcherSnapshot
} from './launcher-items';

/** Why a read of the organization's apps gave nothing (a code only: never a token, an address or an answer body). */
export type LauncherReadCode = 'platform_url_unusable' | 'feed_unavailable' | 'feed_refused' | 'invalid_answer';

export class LauncherReadError extends Error {
	constructor(readonly code: LauncherReadCode) {
		super(`The App Launcher could not read the organization's apps (${code}).`);
		this.name = 'LauncherReadError';
	}
}

/** Ever Works' catalog read waits at most this long, as the SDK's catalog loader does. */
export const CATALOG_TIMEOUT_MS = 2000;

/** The catalog read from Ever Works is reused this long (it is published with `max-age=3600`). */
export const CATALOG_TTL_MS = 60 * 60 * 1000;

/** After a failed catalog read, the bundled list is used this long before Ever Works is asked again. */
export const CATALOG_RETRY_MS = 5 * 60 * 1000;

/** The largest answer read: installs are at most 500, apps one page of {@link APPS_PAGE_SIZE}. */
export const MAX_ANSWER_BYTES = 4 * 1024 * 1024;

/** One page of apps (Ever Platform's largest). */
export const APPS_PAGE_SIZE = 100;

/** The environment the catalog is labelled with. */
const ENVIRONMENT: AppLauncherEnvironment = 'production';

const USER_AGENT = `gauzy-ever-connect/${MODULE_VERSION} (app-launcher)`;

/** Reads an answer body, refusing it past `limit` bytes (the read stops there). */
async function readLimited(response: Response, limit: number): Promise<string> {
	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > limit) {
		await response.body?.cancel().catch(() => undefined);
		throw new LauncherReadError('invalid_answer');
	}
	if (!response.body) {
		return new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer());
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > limit) {
			await reader.cancel().catch(() => undefined);
			throw new LauncherReadError('invalid_answer');
		}
		chunks.push(value);
	}
	return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

/**
 * The App Launcher's three reads, each to a fixed path:
 *
 * - `GET <EVER_WORKS_API_URL>/api/app-launcher/platforms`: Ever Works' public catalog of Ever apps, without any
 *   credential, at most every hour (the bundled list stands in when it cannot be read);
 * - `GET <EVER_PLATFORM_API_URL>/v1/orgs/{org}/installs` and `GET .../v1/orgs/{org}/apps?limit=100`: what the
 *   linked Ever organization installed from apps.ever.co, and its apps, with the person's token exchanged for
 *   `apps:read` in the `Authorization` header (never in the address).
 *
 * The two Ever Platform reads are not in the operation table of the SDK release this plugin pins
 * (`@ever-co/connect-sdk` 1.0.0-rc.8), so they are made here, under the same rules as the SDK's transport: the
 * address is the configured base plus a fixed path (the organization id encoded as one segment), redirects are
 * refused rather than followed, no cookie is sent, every read has a deadline and a size limit, and an error carries
 * a code only. Move them to the SDK client once its table has `listInstalls` and `listOrganizationApps`.
 */
@Injectable()
export class LauncherReads {
	private readonly fetcher: typeof globalThis.fetch;
	private readonly now: () => number;
	private catalogCache: { value: AppLauncherPlatformsResponse; until: number } | null = null;
	/** The catalog read in flight: concurrent callers that find no usable catalog share it (cleared once it settles). */
	private catalogRead: Promise<AppLauncherPlatformsResponse> | null = null;

	constructor(
		@Inject(EVER_CONNECT_SETTINGS) private readonly connect: EverConnectConfig,
		@Inject(EVER_CONNECT_LAUNCHER_SETTINGS) private readonly launcher: LauncherConfig,
		@Optional() @Inject(EVER_CONNECT_FETCH) fetchImpl?: typeof globalThis.fetch,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.fetcher = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
		this.now = () => (clock ?? Date).now();
	}

	/**
	 * The Ever apps: Ever Works' public catalog, or the bundled list when it cannot be read. One read at a time: when
	 * the kept catalog has expired, every concurrent caller waits for the same read.
	 */
	async catalog(): Promise<AppLauncherPlatformsResponse> {
		if (this.catalogCache && this.catalogCache.until > this.now()) {
			return this.catalogCache.value;
		}
		if (!this.catalogRead) {
			this.catalogRead = this.loadCatalog().finally(() => {
				this.catalogRead = null;
			});
		}
		return this.catalogRead;
	}

	/** Reads the catalog (or takes the bundled list), kept for {@link CATALOG_TTL_MS} or {@link CATALOG_RETRY_MS}. */
	private async loadCatalog(): Promise<AppLauncherPlatformsResponse> {
		const read = this.launcher.catalogUrl ? await this.readCatalog(this.launcher.catalogUrl) : null;
		const value = read ?? launcherSnapshot(ENVIRONMENT);
		this.catalogCache = { value, until: this.now() + (read ? CATALOG_TTL_MS : CATALOG_RETRY_MS) };
		return value;
	}

	/** The organization's installs (`GET /v1/orgs/{org}/installs`). */
	async installs(org: string, token: string): Promise<LauncherInstall[]> {
		const body = await this.platformRead(`/v1/orgs/${this.segment(org)}/installs`, token);
		const items = (body as { items?: unknown })?.items;
		if (!Array.isArray(items)) {
			throw new LauncherReadError('invalid_answer');
		}
		return items.filter(
			(item): item is LauncherInstall =>
				!!item &&
				typeof item.id === 'string' &&
				typeof item.listing_title === 'string' &&
				typeof item.state === 'string'
		);
	}

	/** The organization's apps, first page (`GET /v1/orgs/{org}/apps?limit=100`); `truncated` when there are more. */
	async apps(org: string, token: string): Promise<{ items: LauncherApp[]; truncated: boolean }> {
		const body = await this.platformRead(`/v1/orgs/${this.segment(org)}/apps?limit=${APPS_PAGE_SIZE}`, token);
		const page = body as { items?: unknown; next_cursor?: unknown };
		if (!Array.isArray(page?.items)) {
			throw new LauncherReadError('invalid_answer');
		}
		const items = page.items.filter(
			(item): item is LauncherApp =>
				!!item &&
				typeof item.id === 'string' &&
				typeof item.name === 'string' &&
				typeof item.status === 'string' &&
				Array.isArray(item.deployments)
		);
		return { items, truncated: typeof page.next_cursor === 'string' && page.next_cursor !== '' };
	}

	/** One path segment: the organization id as Ever Platform names it, encoded. */
	private segment(org: string): string {
		if (typeof org !== 'string' || org === '' || org.length > 256) {
			throw new LauncherReadError('feed_refused');
		}
		return encodeURIComponent(org);
	}

	private async platformRead(path: string, token: string): Promise<unknown> {
		if (!this.connect.apiUrl) {
			throw new LauncherReadError('platform_url_unusable');
		}
		const answer = await this.send(`${this.connect.apiUrl}${path}`, CONSTANTS.timeouts_ms.read, {
			accept: 'application/json, application/problem+json',
			authorization: `Bearer ${token}`
		});
		if (!answer) {
			throw new LauncherReadError('feed_unavailable');
		}
		if (answer.status < 200 || answer.status > 299) {
			throw new LauncherReadError(
				answer.status >= 500 || answer.status === 429 ? 'feed_unavailable' : 'feed_refused'
			);
		}
		try {
			return JSON.parse(answer.text);
		} catch {
			throw new LauncherReadError('invalid_answer');
		}
	}

	private async readCatalog(base: string): Promise<AppLauncherPlatformsResponse | null> {
		const answer = await this.send(`${base}/api/app-launcher/platforms`, CATALOG_TIMEOUT_MS, {
			accept: 'application/json'
		});
		if (!answer || answer.status !== 200) {
			return null;
		}
		try {
			const body = JSON.parse(answer.text) as Partial<AppLauncherPlatformsResponse>;
			if (!Array.isArray(body?.platforms)) {
				return null;
			}
			return {
				catalogVersion: typeof body.catalogVersion === 'string' ? body.catalogVersion : null,
				environment: ENVIRONMENT,
				platforms: body.platforms.filter(isLauncherItem)
			};
		} catch {
			return null;
		}
	}

	/**
	 * One GET: no redirect followed, no cookie, a deadline and a size limit. `null` when nothing usable came back
	 * (unreachable, timed out, redirected, too large); never throws with the request in it.
	 */
	private async send(
		url: string,
		timeoutMs: number,
		headers: Record<string, string>
	): Promise<{ status: number; text: string } | null> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await this.fetcher(url, {
				method: 'GET',
				headers: { ...headers, 'user-agent': USER_AGENT },
				redirect: 'manual',
				credentials: 'omit',
				cache: 'no-store',
				signal: controller.signal
			});
			if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
				await response.body?.cancel().catch(() => undefined);
				return null;
			}
			return { status: response.status, text: await readLimited(response, MAX_ANSWER_BYTES) };
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	}
}
