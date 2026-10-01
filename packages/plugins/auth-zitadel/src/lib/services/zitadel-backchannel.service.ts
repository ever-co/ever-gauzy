import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OidcLogoutTokenService, isOidcError } from '@gauzy/auth';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelSessionService } from './zitadel-session.service';
import { unverifiedIssuer } from './zitadel-token-signin.service';

/** The revocation work gets this long before the handler answers anyway, milliseconds. */
const REVOCATION_BUDGET_MS = 4000;

/**
 * Handles OpenID Connect back-channel logout requests.
 *
 * A token that fails validation, names no session (`sid`) or repeats a `jti` answers 400 and changes
 * nothing. A valid one answers 200 within a few seconds: revocation failures are logged, never
 * returned, as the specification asks.
 */
@Injectable()
export class ZitadelBackchannelService {
	private readonly logger = new Logger(ZitadelBackchannelService.name);

	constructor(
		private readonly config: ZitadelConfigService,
		private readonly logoutTokens: OidcLogoutTokenService,
		private readonly sessions: ZitadelSessionService
	) {}

	async handle(logoutToken: string): Promise<void> {
		const issuer = await this.config.issuer(unverifiedIssuer(logoutToken));
		if (!issuer) {
			throw new BadRequestException();
		}

		let sid: string | undefined;
		let jti: string;
		try {
			const token = await this.logoutTokens.validate(issuer, logoutToken);
			sid = token.sid;
			jti = token.jti;
		} catch (error) {
			this.logger.warn(`Back-channel logout refused: ${isOidcError(error) ? error.code : 'invalid token'}`);
			throw new BadRequestException();
		}
		if (!sid) {
			throw new BadRequestException();
		}
		if (!(await this.sessions.rememberLogoutJti(jti))) {
			this.logger.warn('Back-channel logout refused: replayed token.');
			throw new BadRequestException();
		}

		let timer: NodeJS.Timeout;
		const budget = new Promise<void>((resolve) => {
			timer = setTimeout(resolve, REVOCATION_BUDGET_MS);
		});
		try {
			await Promise.race([
				this.sessions.endSessions(sid).catch((error) => {
					this.logger.error(`Back-channel logout could not end every session: ${error?.message ?? error}`);
				}),
				budget
			]);
		} finally {
			clearTimeout(timer);
		}
	}
}
