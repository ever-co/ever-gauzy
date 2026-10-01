import { Logger } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AuthZitadelModule } from './auth-zitadel.module';
import { ZITADEL_ENTITIES } from './entities';

/**
 * Ever ID as an additional sign-in method.
 *
 * Loaded by the API only with `ZITADEL_ENABLED=true` (see `isZitadelEnabled`). Unset, nothing of it
 * exists at runtime: no route, no timer, no outbound request. Every existing sign-in method is
 * unchanged either way.
 */
@Plugin({
	imports: [AuthZitadelModule],
	entities: [...ZITADEL_ENTITIES]
})
export class AuthZitadelPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private readonly logger = new Logger(AuthZitadelPlugin.name);

	onPluginBootstrap(): void {
		this.logger.log('Ever ID sign-in is enabled.');
	}

	onPluginDestroy(): void {
		this.logger.log('Ever ID sign-in is shutting down.');
	}
}
