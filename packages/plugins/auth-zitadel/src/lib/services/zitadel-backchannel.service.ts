import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OidcLogoutTokenService, isOidcError } from '@gauzy/auth';
import { ZitadelAccountService } from './zitadel-account.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelSessionService } from './zitadel-session.service';
import { unverifiedIssuer } from './zitadel-token-signin.service';

/**
 * Handles OpenID Connect back-channel logout requests.
 *
 * A token that fails validation or repeats an accepted `jti` answers 400 and changes nothing. A token
 * naming a session (`sid`) ends the Gauzy sessions opened through that session; a token naming only a
 * subject ends every Gauzy session opened through Ever ID by the accounts linked to that subject.
 * The `jti` is remembered only once the sessions are ended, so when ending them fails the answer is
 * 503 and the identity provider can send the same logout again (ending sessions twice is harmless).
 */
@Injectable()
export class ZitadelBackchannelService {
	private readonly logger = new Logger(ZitadelBackchannelService.name);

	constructor(
		private readonly config: ZitadelConfigService,
		private readonly logoutTokens: OidcLogoutTokenService,
		private readonly sessions: ZitadelSessionService,
		private readonly accounts: ZitadelAccountService
	) {}

	async handle(logoutToken: string): Promise<void> {
		const issuer = await this.config.issuer(unverifiedIssuer(logoutToken));
		if (!issuer) {
			throw new BadRequestException();
		}

		let token: Awaited<ReturnType<OidcLogoutTokenService['validate']>>;
		try {
			token = await this.logoutTokens.validate(issuer, logoutToken);
		} catch (error) {
			this.logger.warn(`Back-channel logout refused: ${isOidcError(error) ? error.code : 'invalid token'}`);
			throw new BadRequestException();
		}
		if (await this.sessions.isLogoutJtiKnown(token.jti)) {
			this.logger.warn('Back-channel logout refused: replayed token.');
			throw new BadRequestException();
		}

		try {
			if (token.sid) {
				await this.sessions.endSessions(token.sid);
			} else {
				const users = await this.accounts.findLinkedUsers(token.issuer, token.subject);
				await this.sessions.endSessionsOfUsers(users.map((user) => user.id));
			}
		} catch (error) {
			this.logger.error(`Back-channel logout could not end the sessions: ${error?.message ?? error}`);
			throw new ServiceUnavailableException();
		}
		// The logout succeeded. A concurrent copy of the same token may have been remembered first, and a
		// failure to remember it only weakens replay protection for this harmless operation.
		await this.sessions.rememberLogoutJti(token.jti).catch((error) => {
			this.logger.warn(`Back-channel logout token id not remembered: ${error?.message ?? error}`);
		});
	}
}
