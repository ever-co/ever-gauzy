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
	CONFIRMATION_INVALID = 'SESSION_CONFIRMATION_INVALID'
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
		await this.revoke(userId, session.tokens);
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
		const now = new Date();
		const otherSessions = groupUserSessions(tokens, now).filter((group) => group.id !== currentSessionId);
		const outsideCurrentSession = (token: IToken) => sessionIdOf(token) !== currentSessionId;
		const toRevoke = [
			...tokens.refreshTokens.filter(outsideCurrentSession),
			...tokens.accessTokens.filter((token) => isFirstPartyAccessToken(token) && outsideCurrentSession(token))
		];
		await this.revoke(userId, toRevoke);

		this.logger.log(`User ${userId} signed out ${otherSessions.length} other session(s)`);
		return { signedOut: otherSessions.length };
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
