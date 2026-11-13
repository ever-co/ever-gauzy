import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EVER_CONNECT_CLOCK } from '../ever-connect.constants';
import type { OrganizationScope } from '../ever-connect-request';
import { EverConnectStore } from '../ever-connect.store';
import type { LauncherAppsResponse, LauncherConfigResponse, LauncherWorksErrorCode } from '../dto/launcher.dto';
import { EverConnectLauncherTokenService, LauncherTokenError } from './ever-connect-launcher-token.service';
import { EVER_CONNECT_LAUNCHER_SETTINGS, LAUNCHER_CURRENT, LauncherConfig } from './launcher-config';
import { AppLauncherListResponse, mapApps, mapInstalls, mergeLauncherResponse } from './launcher-items';
import { LauncherReadError, LauncherReads } from './launcher-reads';

/** A person's answer for one organization is reused this long. */
export const LAUNCHER_CACHE_MS = 60 * 1000;

/** The most answers this process holds at once. */
const MAX_CACHED_ANSWERS = 5000;

/**
 * What the App Launcher shows a person for one Gauzy organization: the Ever apps, and "Your apps" of the Ever
 * organization that Gauzy organization is linked to (its installs from apps.ever.co and its live apps), read from Ever
 * Platform with the person's delegated `apps:read` token.
 *
 * - No Ever ID session (the person signed in some other way): the Ever apps only, with `signInAvailable`.
 * - The organization is not linked: the Ever apps, and an empty "Your apps" (no token is asked for).
 * - Ever Platform or Ever ID cannot answer: the Ever apps, and `error.section = 'works'` (never cached, so the next
 *   open tries again).
 *
 * A complete answer is reused for {@link LAUNCHER_CACHE_MS} per person and organization, in memory only, and
 * concurrent requests that find no answer share one read (an answer in error included, which is never kept). Nothing
 * is written anywhere: reading changes no state, so nothing is audited. Problems are logged with a code only.
 */
@Injectable()
export class EverConnectLauncherService {
	private readonly logger = new Logger('EverConnect');
	private readonly answers = new Map<string, { value: LauncherAppsResponse; until: number }>();
	/** The read in flight per answer key: concurrent misses for one key share it (removed once it settles). */
	private readonly reading = new Map<string, Promise<LauncherAppsResponse>>();
	private readonly now: () => number;

	constructor(
		@Inject(EVER_CONNECT_LAUNCHER_SETTINGS) private readonly config: LauncherConfig,
		private readonly store: EverConnectStore,
		private readonly reads: LauncherReads,
		private readonly tokens: EverConnectLauncherTokenService,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = () => (clock ?? Date).now();
	}

	/** `GET /api/ever-connect/launcher/config` for the signed-in person. */
	async settings(userId: string): Promise<LauncherConfigResponse> {
		return {
			enabled: true,
			current: LAUNCHER_CURRENT,
			worksAppUrl: this.config.worksAppUrl,
			signInAvailable: !(await this.tokens.sessionOf(userId))
		};
	}

	/** `GET /api/ever-connect/launcher/apps?organizationId=` for an organization the person is a member of. */
	async list(scope: OrganizationScope): Promise<LauncherAppsResponse> {
		// An answer belongs to the Ever ID session it was read with: once that session ends, it is never reused.
		const sid = await this.tokens.sessionOf(scope.userId);
		const key = `${scope.tenantId}|${scope.userId}|${scope.organizationId}|${sid ?? ''}`;
		const cached = sid ? this.answers.get(key) : undefined;
		if (cached && cached.until > this.now()) {
			return cached.value;
		}
		this.answers.delete(key);
		let pending = this.reading.get(key);
		if (!pending) {
			pending = this.read(scope, sid, key).finally(() => this.reading.delete(key));
			this.reading.set(key, pending);
		}
		return pending;
	}

	/** Reads the answer for `key` (catalog, link, token, Ever Platform's two reads) and keeps a complete one. */
	private async read(scope: OrganizationScope, sid: string | null, key: string): Promise<LauncherAppsResponse> {
		const catalog = await this.reads.catalog();
		if (!sid) {
			return this.answer(mergeLauncherResponse({ catalog, current: `platform:${LAUNCHER_CURRENT}` }), true, null);
		}
		const link = await this.store.linkOf(scope.tenantId, scope.organizationId);
		if (!link || link.status !== 'linked') {
			const empty = this.answer(
				mergeLauncherResponse({ catalog, current: `platform:${LAUNCHER_CURRENT}` }),
				false,
				null
			);
			this.remember(key, empty);
			return empty;
		}
		// Configuration loading already warned once; not cached, so a later change shows.
		if (!this.config.audience) {
			return this.answer(
				mergeLauncherResponse({ catalog, current: `platform:${LAUNCHER_CURRENT}` }),
				false,
				'not_configured'
			);
		}

		let code: LauncherWorksErrorCode;
		try {
			const delegated = await this.tokens.delegatedToken(scope.userId, sid);
			if (delegated.kind === 'no_session') {
				return this.answer(
					mergeLauncherResponse({ catalog, current: `platform:${LAUNCHER_CURRENT}` }),
					true,
					null
				);
			}
			const [installs, apps] = await Promise.all([
				this.reads.installs(link.everOrgId, delegated.token),
				this.reads.apps(link.everOrgId, delegated.token)
			]);
			const merged = mergeLauncherResponse({
				catalog,
				installs: mapInstalls(installs),
				apps: mapApps(apps.items),
				current: `platform:${LAUNCHER_CURRENT}`,
				scopeKey: `org:${link.everOrgId}`,
				truncated: apps.truncated
			});
			const complete = this.answer(merged, false, null);
			this.remember(key, complete);
			return complete;
		} catch (error) {
			code = this.codeOf(error);
		}
		this.logger.warn(
			`The App Launcher shows the Ever apps only for organization ${scope.organizationId} (${code}).`
		);
		return this.answer(mergeLauncherResponse({ catalog, current: `platform:${LAUNCHER_CURRENT}` }), false, code);
	}

	private answer(
		data: AppLauncherListResponse,
		signInAvailable: boolean,
		code: LauncherWorksErrorCode | null
	): LauncherAppsResponse {
		return { ...data, signInAvailable, error: code ? { section: 'works', code } : null };
	}

	private codeOf(error: unknown): LauncherWorksErrorCode {
		if (error instanceof LauncherTokenError) {
			return error.code === 'not_configured' ? 'not_configured' : 'token_unavailable';
		}
		if (error instanceof LauncherReadError) {
			return error.code === 'feed_refused' ? 'feed_refused' : 'feed_unavailable';
		}
		return 'feed_unavailable';
	}

	private remember(key: string, value: LauncherAppsResponse): void {
		const now = this.now();
		if (this.answers.size >= MAX_CACHED_ANSWERS) {
			for (const [other, entry] of this.answers) {
				if (entry.until <= now) this.answers.delete(other);
			}
			for (const other of this.answers.keys()) {
				if (this.answers.size < MAX_CACHED_ANSWERS) break;
				this.answers.delete(other);
			}
		}
		this.answers.set(key, { value, until: now + LAUNCHER_CACHE_MS });
	}
}
