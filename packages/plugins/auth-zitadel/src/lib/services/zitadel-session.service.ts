import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { environment } from '@gauzy/config';
import { ID } from '@gauzy/contracts';
import { Token } from '@gauzy/core';
import { ZitadelLogoutJti } from '../entities/zitadel-logout-jti.entity';
import { ZitadelSession } from '../entities/zitadel-session.entity';

/**
 * Token types of the platform's database-backed access and refresh tokens (the values the core
 * access-token and refresh-token modules register).
 */
export const PLATFORM_SESSION_TOKEN_TYPES = ['ACCESS_TOKEN_TYPE', 'REFRESH_TOKEN_TYPE'];

/** A logout token `jti` is remembered this long. */
export const LOGOUT_JTI_TTL_MS = 600 * 1000;

/** The pruning job runs once a day. */
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Default lifetime of a session record when the refresh-token lifetime is not configured (7 days). */
const DEFAULT_SESSION_RETENTION_S = 7 * 24 * 60 * 60;

/**
 * Remembers the Gauzy sessions opened through Ever ID and ends them on a back-channel logout.
 *
 * A session record is written when a sign-in hands out workspace tokens. When the identity provider
 * reports that session `sid` ended, the database-backed access and refresh tokens of each recorded
 * user that were issued at or after the session record are revoked; sessions the user opened some
 * other way, or before, keep working.
 */
@Injectable()
export class ZitadelSessionService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(ZitadelSessionService.name);
	private timer: NodeJS.Timeout | null = null;

	constructor(
		@InjectRepository(ZitadelSession) private readonly sessions: Repository<ZitadelSession>,
		@InjectRepository(ZitadelLogoutJti) private readonly logoutJtis: Repository<ZitadelLogoutJti>,
		@InjectRepository(Token) private readonly tokens: Repository<Token>
	) {}

	onModuleInit(): void {
		this.timer = setInterval(() => {
			this.prune().catch((error) => this.logger.warn(`Pruning failed: ${error?.message ?? error}`));
		}, PRUNE_INTERVAL_MS);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	/**
	 * Records that `users` were handed workspace tokens within the identity provider session `sid`.
	 */
	async record(sid: string | undefined, users: Array<{ id?: ID; tenantId?: ID | null }>): Promise<void> {
		const signedIn = users.filter((user) => !!user.id);
		if (!sid || !signedIn.length) {
			return;
		}
		await this.sessions.save(
			signedIn.map((user) =>
				this.sessions.create({ sid, userId: user.id, tenantId: user.tenantId ?? null, accessTokenId: null, refreshTokenId: null })
			)
		);
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

	/**
	 * Ends the Gauzy sessions opened through the identity provider session `sid`.
	 *
	 * @returns The number of tokens revoked.
	 */
	async endSessions(sid: string): Promise<number> {
		const rows = await this.sessions.find({ where: { sid } });
		let revoked = 0;
		for (const row of rows) {
			const result = await this.tokens.update(
				{
					userId: row.userId,
					tokenType: In(PLATFORM_SESSION_TOKEN_TYPES),
					status: 'ACTIVE' as Token['status'],
					createdAt: MoreThanOrEqual(row.createdAt)
				},
				{ status: 'REVOKED' as Token['status'], revokedAt: new Date(), revokedReason: 'Signed out of Ever ID' }
			);
			revoked += result?.affected ?? 0;
		}
		if (rows.length) {
			await this.sessions.delete({ id: In(rows.map((row) => row.id)) });
		}
		return revoked;
	}

	/**
	 * Deletes session records older than the refresh-token lifetime and expired logout token ids.
	 */
	async prune(now = new Date()): Promise<void> {
		const retentionSeconds = Number(environment.JWT_REFRESH_TOKEN_EXPIRATION_TIME) || DEFAULT_SESSION_RETENTION_S;
		await this.sessions.delete({ createdAt: LessThan(new Date(now.getTime() - retentionSeconds * 1000)) });
		await this.logoutJtis.delete({ expiresAt: LessThan(now) });
	}
}
