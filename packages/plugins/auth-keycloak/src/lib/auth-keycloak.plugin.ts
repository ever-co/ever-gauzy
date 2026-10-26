import { Logger } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AuthKeycloakModule } from './auth-keycloak.module';

/**
 * Keycloak as an additional sign-in method.
 *
 * Loaded by the API only when `KEYCLOAK_ENABLED=true` and a Keycloak client id and secret are set
 * (see `isKeycloakEnabled`). It adds `GET /api/auth/keycloak`, `/callback` and `/config`; every
 * existing sign-in method is unchanged.
 */
@Plugin({
	imports: [AuthKeycloakModule]
})
export class AuthKeycloakPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private readonly logger = new Logger(AuthKeycloakPlugin.name);

	onPluginBootstrap(): void {
		this.logger.log('Keycloak sign-in is enabled.');
	}

	onPluginDestroy(): void {
		this.logger.log('Keycloak sign-in is shutting down.');
	}
}
