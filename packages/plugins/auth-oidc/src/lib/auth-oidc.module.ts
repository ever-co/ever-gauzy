import { Logger, Module } from '@nestjs/common';
import { OidcModule } from '@gauzy/auth';
import { AuthModule, AuthService } from '@gauzy/core';
import { parseOidcSettings } from './auth-oidc.config';
import { AuthOidcController } from './auth-oidc.controller';
import { AuthOidcSignInService } from './auth-oidc-sign-in.service';
import { AUTH_OIDC_SETTINGS } from './auth-oidc.tokens';
import { SOCIAL_SIGN_IN } from './social-sign-in.port';

/** Settings are read once, when the module starts; each fallback is logged once, without secrets. */
const settingsProvider = {
	provide: AUTH_OIDC_SETTINGS,
	useFactory: () => {
		const logger = new Logger('AuthOidcPlugin');
		return parseOidcSettings(process.env, (message) => logger.warn(message));
	}
};

/**
 * OpenID Connect sign-in routes under `/api/auth/oidc`, built on the shared OIDC library of `@gauzy/auth`.
 */
@Module({
	imports: [OidcModule, AuthModule],
	controllers: [AuthOidcController],
	providers: [
		settingsProvider,
		AuthOidcSignInService,
		// Gauzy's existing social sign-in (link by verified e-mail), as the other social routes use it.
		{ provide: SOCIAL_SIGN_IN, useExisting: AuthService }
	]
})
export class AuthOidcModule {}
