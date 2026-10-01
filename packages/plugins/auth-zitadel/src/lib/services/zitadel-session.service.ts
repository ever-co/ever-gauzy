import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { environment } from '@gauzy/config';
import { ID } from '@gauzy/contracts';
import { Token } from '@gauzy/core';
import { ZitadelLogoutJti } from '../entities/zitadel-logout-jti.entity';
import { ZitadelSession } from '../entities/zitadel-session.entity';
import {
	IssuedPlatformToken,
	PLATFORM_REFRESH_TOKEN_TYPE,
	ZitadelTokenBinder,
	ZitadelTokenBinding
} from '../subscribers/zitadel-token-binding';
import { ZitadelStoreService } from './zitadel-store.service';

/** A logout token `jti` is remembered this long. */
export const LOGOUT_JTI_TTL_MS = 600 * 1000;

/**
 * A refresh token the platform issues to a user within this long after an Ever ID hand-off belongs to
 * that hand-off's session (the person picks a workspace and the web app signs in).
 */
export const SESSION_BIND_WINDOW_MS = 15 * 60 * 1000;

/** Store namespace of the marker that points a user's next refresh token at a session record. */
const BIND_MARKER = 'session-bind';

/** The pruning job runs once a day, and once shortly after start. */
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FIRST_PRUNE_DELAY_MS = 60 * 1000;

/** Default lifetime of a session record when the refresh-token lifetime is not configured (7 days). */
const DEFAULT_SESSION_RETENTION_S = 7 * 24 * 60 * 60;

/** Longest refresh-token rotation chain followed when a session ends. */
const MAX_ROTATION_DEPTH = 1000;

/**
 * Follow-up passes of a revocation, milliseconds: a token row may not be committed yet, and a refresh
 * running at the same moment may still add a rotated successor.
 */
const FOLLOW_UP_DELAYS_MS = [1000, 5000, 15000];

/** Retries of a binding that failed on a transient error, milliseconds. */
const BIND_RETRY_DELAYS_MS = [1000, 5000];

/**
 * Remembers the Gauzy sessions opened through Ever ID and ends exactly those on a back-channel logout.
 *
 * A session record is written when a sign-in hands out workspace tokens, together with a short-lived
 * marker in the one-time store. When Gauzy then issues the user's next refresh token (the sign-in
 * finishing), the marker binds the record to it ({@link bindRefreshToken}); the marker's lifetime is
 * kept by the store, so no clock is compared with database timestamps. A logout for the
 * session revokes that refresh token and every token rotated from it, so the session cannot be
 * renewed; sessions the person opened some other way keep working. A logout that arrives before the
 * sign-in finished leaves the record marked as ended, and the refresh token the sign-in still produces
 * is revoked as soon as it is issued.
 *
 * Access tokens already issued stay valid until they expire (`JWT_TOKEN_EXPIRATION_TIME`): Gauzy
 * verifies them by signature and does not look them up.
 */
@Injectable()
export class ZitadelSessionService implements OnModuleInit, OnModuleDestroy, ZitadelTokenBinder {
	private readonly logger = new Logger(ZitadelSessionService.name);
	private timers: NodeJS.Timeout[] = [];

	constructor(
		@InjectRepository(ZitadelSession) private readonly sessions: Repository<ZitadelSession>,
		@InjectRepository(ZitadelLogoutJti) private readonly logoutJtis: Repository<ZitadelLogoutJti>,
		@InjectRepository(Token) private readonly tokens: Repository<Token>,
		private readonly store: ZitadelStoreService
	) {}

	onModuleInit(): void {
		const prune = () => this.prune().catch((error) => this.logger.warn(`Pruning failed: ${error?.message ?? error}`));
		const first = setTimeout(prune, FIRST_PRUNE_DELAY_MS);
		const daily = setInterval(prune, PRUNE_INTERVAL_MS);
		first.unref();
		daily.unref();
		this.timers = [first, daily];
		ZitadelTokenBinding.register(this);
	}

	onModuleDestroy(): void {
		ZitadelTokenBinding.register(null);
		for (const timer of this.timers) {
			clearTimeout(timer);
		}
		this.timers = [];
	}

	/**
	 * Records that `users` were handed workspace tokens within the identity provider session `sid`.
	 */
	async record(sid: string | undefined, users: Array<{ id?: ID; tenantId?: ID | null }>): Promise<void> {
		const signedIn = users.filter((user) => !!user.id);
		if (!signedIn.length) {
			return;
		}
		// Recorded without a session id too: a logout token naming only the subject still finds it.
		const rows = await this.sessions.save(
			signedIn.map((user) =>
				this.sessions.create({
					sid: sid ?? '',
					userId: user.id,
					tenantId: user.tenantId ?? null,
					accessTokenId: null,
					refreshTokenId: null
				})
			)
		);
		for (const row of rows) {
			await this.store.put(BIND_MARKER, this.markerKey(row.userId), { sessionId: row.id }, SESSION_BIND_WINDOW_MS / 1000);
		}
	}

	/**
	 * Binds the session record of the user's latest Ever ID hand-off (within
	 * {@link SESSION_BIND_WINDOW_MS}) to a refresh token the platform just issued. A rotated token
	 * belongs to the chain of its predecessor and is not bound itself.
	 */
	async bindRefreshToken(token: IssuedPlatformToken, attempt = 0): Promise<void> {
		if (!token?.id || !token.userId || token.tokenType !== PLATFORM_REFRESH_TOKEN_TYPE || token.rotatedFromTokenId) {
			return;
		}
		try {
			const markerKey = this.markerKey(token.userId);
			const marker = await this.store.get<{ sessionId: ID }>(BIND_MARKER, markerKey);
			if (!marker?.sessionId) {
				return;
			}
			// Bound once: of two sign-ins racing for the same marker, only one gets the record.
			const result = await this.sessions.update({ id: marker.sessionId, refreshTokenId: IsNull() }, { refreshTokenId: token.id });
			if (!result?.affected) {
				return;
			}
			// The user's next sign-in, and only that one, belongs to the hand-off.
			await this.store.delete(BIND_MARKER, markerKey);
			const row = await this.sessions.findOne({ where: { id: marker.sessionId } });
			if (row?.isActive === false) {
				// The identity provider already ended this session: the sign-in must not outlive it.
				this.revokeWithFollowUps([token.id]);
			}
		} catch (error) {
			// The marker is still there: try again shortly instead of losing the binding.
			if (attempt < BIND_RETRY_DELAYS_MS.length) {
				setTimeout(() => void this.bindRefreshToken(token, attempt + 1), BIND_RETRY_DELAYS_MS[attempt]).unref();
			} else {
				this.logger.error(`Could not bind an Ever ID session to its sign-in: ${error?.message ?? error}`);
			}
		}
	}

	/**
	 * Remembers a logout token id. Returns `false` when it was seen before (a replay).
	 */
	async rememberLogoutJti(jti: string): Promise<boolean> {
		if (await this.logoutJtis.findOne({ where: { jti }, select: { id: true } })) {
			return false;
		}
		try {
			await this.logoutJtis.insert({ jti, expiresAt: new Date(Date.now() + LOGOUT_JTI_TTL_MS) });
			return true;
		} catch {
			// The unique index refused a concurrent insert of the same jti.
			return false;
		}
	}

	/** Whether a logout token id was already accepted (a replay). */
	async isLogoutJtiKnown(jti: string): Promise<boolean> {
		return !!(await this.logoutJtis.findOne({ where: { jti }, select: { id: true } }));
	}

	/**
	 * Ends the Gauzy sessions opened through the identity provider session `sid`.
	 *
	 * @returns The number of tokens revoked.
	 */
	async endSessions(sid: string): Promise<number> {
		return this.endRows(await this.sessions.find({ where: { sid } }));
	}

	/**
	 * Ends every Gauzy session opened through Ever ID by these users (a logout token naming a subject
	 * but no session).
	 *
	 * @returns The number of tokens revoked.
	 */
	async endSessionsOfUsers(userIds: ID[]): Promise<number> {
		if (!userIds.length) {
			return 0;
		}
		return this.endRows(await this.sessions.find({ where: { userId: In(userIds) } }));
	}

	/**
	 * Deletes session records older than the refresh-token lifetime, ended records whose sign-in never
	 * finished, and expired logout token ids.
	 */
	async prune(now = new Date()): Promise<void> {
		const retentionSeconds = Number(environment.JWT_REFRESH_TOKEN_EXPIRATION_TIME) || DEFAULT_SESSION_RETENTION_S;
		await this.sessions.delete({ createdAt: LessThan(new Date(now.getTime() - retentionSeconds * 1000)) });
		await this.sessions.delete({
			isActive: false,
			createdAt: LessThan(new Date(now.getTime() - SESSION_BIND_WINDOW_MS))
		});
		await this.logoutJtis.delete({ expiresAt: LessThan(now) });
	}

	/** The store key of a user's binding marker (a digest, so any user id fits the key format). */
	private markerKey(userId: ID): string {
		return this.store.identityKey(BIND_MARKER, userId);
	}

	private async endRows(rows: ZitadelSession[]): Promise<number> {
		const bound = rows.filter((row) => !!row.refreshTokenId);
		const pending = rows.filter((row) => !row.refreshTokenId && row.isActive !== false);
		const boundTokens = bound.map((row) => row.refreshTokenId);
		if (pending.length) {
			const pendingIds = pending.map((row) => row.id);
			// Kept, marked as ended: the refresh token their sign-in still produces is revoked on arrival.
			await this.sessions.update({ id: In(pendingIds) }, { isActive: false, archivedAt: new Date() });
			// A sign-in may have bound one of them in the meantime, before it could see the mark.
			const boundMeanwhile = await this.sessions.find({ where: { id: In(pendingIds), refreshTokenId: Not(IsNull()) } });
			boundTokens.push(...boundMeanwhile.map((row) => row.refreshTokenId));
		}
		const revoked = await this.revokeChains(boundTokens);
		if (boundTokens.length) {
			this.revokeWithFollowUps(boundTokens, false);
		}
		if (bound.length) {
			await this.sessions.delete({ id: In(bound.map((row) => row.id)) });
		}
		return revoked;
	}

	/** Revokes refresh tokens and every token rotated from them; returns how many were active. */
	private async revokeChains(rootIds: ID[]): Promise<number> {
		if (!rootIds.length) {
			return 0;
		}
		const ids = new Set<ID>(rootIds);
		let frontier: ID[] = [...rootIds];
		for (let depth = 0; frontier.length && depth < MAX_ROTATION_DEPTH; depth++) {
			const successors = await this.tokens.find({ where: { rotatedFromTokenId: In(frontier) }, select: { id: true } });
			frontier = successors.map((token) => token.id).filter((id) => !ids.has(id));
			for (const id of frontier) {
				ids.add(id);
			}
		}
		const result = await this.tokens.update(
			{ id: In([...ids]), status: 'ACTIVE' as Token['status'] },
			{ status: 'REVOKED' as Token['status'], revokedAt: new Date(), revokedReason: 'Signed out of Ever ID' }
		);
		return result?.affected ?? 0;
	}

	/**
	 * Revokes token chains now (unless `now` is false) and again a few times shortly after: a token row
	 * may not be committed yet, and a refresh running at the same moment may still add a successor that
	 * the first walk could not see.
	 */
	private revokeWithFollowUps(rootIds: ID[], now = true): void {
		const run = () =>
			this.revokeChains(rootIds).catch((error) =>
				this.logger.error(`Could not end a session that Ever ID had signed out: ${error?.message ?? error}`)
			);
		if (now) {
			void run();
		}
		for (const delay of FOLLOW_UP_DELAYS_MS) {
			setTimeout(() => void run(), delay).unref();
		}
	}
}
