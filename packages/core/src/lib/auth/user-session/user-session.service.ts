import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ID, IUserSession, IUserSessionSignOutOthersInput, IUserSessionSignOutOthersResponse } from '@gauzy/contracts';
import { AccessTokenService } from '../../access-token/access-token.service';
import { RequestContext } from '../../core/context/request-context';
import { PasswordHashService } from '../../password-hash/password-hash.service';
import { RefreshTokenService } from '../../refresh-token/refresh-token.service';
import { REFRESH_TOKEN_TYPE } from '../../refresh-token/type.token';
import { IToken } from '../../token/interfaces';
import { UserService } from '../../user/user.service';
import { LoginAttemptScope, LoginAttemptService } from '../login-attempt.service';
import { assertFirstPartyRequest } from '../oauth-app-first-party';
import { currentRequestSessionClaims } from './user-session-claims';
import {
	groupUserSessions,
	isFirstPartyAccessToken,
	IUserSessionTokens,
	listUserSessions,
	sessionIdOf
} from './user-session-list';
import { USER_SESSION_SIGNED_OUT_REASON } from './user-session-revocation';

/** The machine-readable reasons a session request is refused with. */
export enum UserSessionRefusal {
	/** The request's own session: sign out with `POST /api/auth/logout` instead. */
	CURRENT_SESSION = 'SESSION_IS_CURRENT',
	/** The request's token names no session (minted before sessions were named): refresh it first. */
	CURRENT_SESSION_UNKNOWN = 'SESSION_UNKNOWN',
	/** Neither the password nor the sign-in code the account needs was sent. */
	CONFIRMATION_REQUIRED = 'SESSION_CONFIRMATION_REQUIRED',
	/** The password or the code is wrong (or the code expired). */
	CONFIRMATION_INVALID = 'SESSION_CONFIRMATION_INVALID',
	/** A session kept renewing its tokens while it was signed out: try again. */
	SIGN_OUT_INCOMPLETE = 'SESSION_SIGN_OUT_INCOMPLETE',
	/** A session minted before sessions were named cannot be signed out alone: sign out all the others instead. */
	UNNAMED_SESSION = 'SESSION_UNNAMED'
}

/** How many read-and-revoke passes a sign-out makes; each catches the tokens a refresh minted during the last one. */
const SIGN_OUT_PASSES = 5;

/** Whether a token belongs to a session: a refresh token, or a sign-in's access token (not an API token's). */
function isSessionToken(token: IToken): boolean {
	if (token.tokenType === REFRESH_TOKEN_TYPE) {
		return true;
	}
	return isFirstPartyAccessToken(token);
}

/**
 * The signed-in user's sessions: each sign-in on one device or app, until it is signed out or expires.
 *
 * **Every read and write here is the caller's own.** The tokens read are the signed-in user's, and a session id only
 * ever names one of them, so nobody lists or signs out another user's sessions.
 *
 * **Only a person in their own session manages sessions.** `assertFirstPartyRequest` refuses a third-party OAuth-app
 * token and a session that came from a personal API token, whose tokens are not sessions and are never signed out here.
 *
 * Signing a session out revokes its access and refresh tokens with `USER_SESSION_SIGNED_OUT_REASON`: its refresh fails
 * at once, and `JwtStrategy` refuses its access token at its next request.
 */
@Injectable()
export class UserSessionService {
	private readonly logger = new Logger(UserSessionService.name);

	constructor(
		private readonly accessTokenService: AccessTokenService,
		private readonly refreshTokenService: RefreshTokenService,
		private readonly userService: UserService,
		private readonly passwordHashService: PasswordHashService,
		private readonly loginAttemptService: LoginAttemptService
	) {}

	/**
	 * The signed-in user's sessions, the current one first, then the most recently used.
	 */
	async listOwn(): Promise<IUserSession[]> {
		assertFirstPartyRequest('Listing sessions');
		const userId = RequestContext.currentUserId();
		const tokens = await this.activeTokensOf(userId);
		return listUserSessions(tokens, this.currentSessionId(), new Date());
	}

	/**
	 * Signs out one session of the signed-in user, other than the session of the request.
	 *
	 * @param sessionId The session, as the list names it.
	 */
	async signOut(sessionId: ID): Promise<void> {
		assertFirstPartyRequest('Signing out a session');
		if (sessionId === this.currentSessionId()) {
			throw new BadRequestException({
				code: UserSessionRefusal.CURRENT_SESSION,
				message: 'This is the session of the request: sign out instead.'
			});
		}

		const userId = RequestContext.currentUserId();
		const tokens = await this.activeTokensOf(userId);
		const session = groupUserSessions(tokens, new Date()).find((group) => group.id === sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}
		// A session minted before sessions were named is listed under its refresh token's id: its access token names no
		// session, so it cannot be told apart from another device's.
		const isUnnamed = session.tokens.every((token) => sessionIdOf(token) === null);
		if (isUnnamed) {
			throw new ConflictException({
				code: UserSessionRefusal.UNNAMED_SESSION,
				message: 'This session started before sessions were named: sign out all the other sessions instead.'
			});
		}
		const isOfSession = (token: IToken) => sessionIdOf(token) === sessionId;
		await this.signOutTokens(userId, isOfSession, this.currentSessionId());
	}

	/**
	 * Signs out every session of the signed-in user but the session of the request, once the person proves they own the
	 * account: with its password, or with the sign-in code e-mailed to it when it has no password. A wrong proof signs
	 * nobody out.
	 *
	 * @param input The password or the code.
	 * @returns How many sessions were signed out.
	 */
	async signOutOthers(input: IUserSessionSignOutOthersInput): Promise<IUserSessionSignOutOthersResponse> {
		assertFirstPartyRequest('Signing out the other sessions');
		const currentSessionId = this.currentSessionId();
		if (!currentSessionId) {
			throw new ConflictException({
				code: UserSessionRefusal.CURRENT_SESSION_UNKNOWN,
				message: 'The session of this request is not known yet: refresh its token, then try again.'
			});
		}

		const userId = RequestContext.currentUserId();
		await this.assertOwnerConfirmed(userId, input);

		const tokens = await this.activeTokensOf(userId);
		const otherSessions = groupUserSessions(tokens, new Date()).filter((group) => group.id !== currentSessionId);
		const isOutsideCurrentSession = (token: IToken) => sessionIdOf(token) !== currentSessionId;
		await this.signOutTokens(userId, isOutsideCurrentSession, currentSessionId);

		this.logger.log(`User ${userId} signed out ${otherSessions.length} other session(s)`);
		return { signedOut: otherSessions.length };
	}

	/**
	 * Revokes the user's tokens that `isTarget` picks, never those of the kept session nor an API token's or an
	 * application's, until a read finds none left.
	 *
	 * A refresh landing meanwhile rotates a picked refresh token and mints its successor and a new access token, in the
	 * same session. Revoking the rotated token then fails, and it waits on the row the rotation locks, so the next read
	 * sees what the rotation minted; a rotation that comes after finds its token revoked and fails.
	 *
	 * @throws ConflictException when tokens are still being minted after {@link SIGN_OUT_PASSES} passes.
	 */
	private async signOutTokens(
		userId: ID,
		isTarget: (token: IToken) => boolean,
		keptSessionId: string | null
	): Promise<void> {
		const isPicked = (token: IToken): boolean => {
			const sessionId = sessionIdOf(token);
			const isKept = sessionId !== null && sessionId === keptSessionId;
			if (isKept || !isSessionToken(token)) {
				return false;
			}
			return isTarget(token);
		};

		for (let pass = 1; pass <= SIGN_OUT_PASSES; pass++) {
			const tokens = await this.activeTokensOf(userId);
			const targets = [...tokens.refreshTokens, ...tokens.accessTokens].filter(isPicked);
			if (targets.length === 0) {
				return;
			}
			await this.revoke(userId, targets);
		}
		throw new ConflictException({
			code: UserSessionRefusal.SIGN_OUT_INCOMPLETE,
			message: 'The session kept renewing its tokens while it was signed out: try again.'
		});
	}

	/** The session the request is made from, null when its token names none. */
	private currentSessionId(): string | null {
		return currentRequestSessionClaims()?.sessionId ?? null;
	}

	/** The user's active refresh and access tokens. */
	private async activeTokensOf(userId: ID): Promise<IUserSessionTokens> {
		const [refreshTokens, accessTokens] = await Promise.all([
			this.refreshTokenService.findActive(userId),
			this.accessTokenService.findActive(userId)
		]);
		return { refreshTokens, accessTokens };
	}

	/** Revokes the tokens of signed-out sessions, each by its own type. */
	private async revoke(userId: ID, tokens: IToken[]): Promise<void> {
		await Promise.all(
			tokens.map((token) => {
				const revocation = {
					tokenId: token.id,
					userId,
					revokedById: userId,
					reason: USER_SESSION_SIGNED_OUT_REASON
				};
				if (token.tokenType === REFRESH_TOKEN_TYPE) {
					return this.refreshTokenService.revokeById(revocation);
				}
				return this.accessTokenService.revokeById(revocation);
			})
		);
	}

	/**
	 * Proves the person at this session owns the account: its password when it has one, otherwise the sign-in code
	 * e-mailed to it (`POST /api/auth/signin.email`), which is spent here. Each try counts against the account like a
	 * sign-in attempt, so this route offers no more guesses than the sign-in does.
	 */
	private async assertOwnerConfirmed(userId: ID, input: IUserSessionSignOutOthersInput): Promise<void> {
		const user = await this.userService.findOneByIdString(userId);
		const hasPassword = !!user.hash;

		if (hasPassword) {
			if (!input.password) {
				throw this.confirmationRequired('This account needs its password.');
			}
			const attempt = await this.loginAttemptService.begin(LoginAttemptScope.PASSWORD, user.email);
			const isValid = await this.passwordHashService.verify(input.password, user.hash).catch(() => false);
			if (!isValid) {
				await attempt.fail();
				throw this.confirmationInvalid();
			}
			await attempt.succeed();
			return;
		}

		if (!input.code) {
			throw this.confirmationRequired('This account has no password: send the code of the sign-in code e-mail.');
		}
		const attempt = await this.loginAttemptService.begin(LoginAttemptScope.MAGIC_CODE, user.email);
		const isClaimed = await this.userService.claimSignInCode(userId, user.email, input.code);
		if (!isClaimed) {
			await attempt.fail();
			throw this.confirmationInvalid();
		}
		await attempt.succeed();
	}

	private confirmationRequired(message: string): BadRequestException {
		return new BadRequestException({ code: UserSessionRefusal.CONFIRMATION_REQUIRED, message });
	}

	private confirmationInvalid(): BadRequestException {
		return new BadRequestException({
			code: UserSessionRefusal.CONFIRMATION_INVALID,
			message: 'The password or the code is not right. No session was signed out.'
		});
	}
}
