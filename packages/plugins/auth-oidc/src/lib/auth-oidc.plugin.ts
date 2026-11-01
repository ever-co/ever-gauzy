import { Logger } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AuthOidcModule } from './auth-oidc.module';

/**
 * Sign-in with any OpenID Connect provider as an additional sign-in method.
 *
 * Loaded by the API only when `OIDC_ENABLED=true` and an issuer, a client id and a client secret are
 * set (see `isOidcEnabled`). It adds `GET /api/auth/oidc`, `/callback` and `/config`; every existing
 * sign-in method is unchanged.
 */
@Plugin({
	imports: [AuthOidcModule]
})
export class AuthOidcPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private readonly logger = new Logger(AuthOidcPlugin.name);

	onPluginBootstrap(): void {
		this.logger.log('OpenID Connect sign-in is enabled.');
	}

	onPluginDestroy(): void {
		this.logger.log('OpenID Connect sign-in is shutting down.');
	}
}
