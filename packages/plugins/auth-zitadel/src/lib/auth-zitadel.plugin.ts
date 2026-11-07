import { Logger } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AuthZitadelModule } from './auth-zitadel.module';
import { AddZitadelSessionRefreshToken1791000006450 } from './database/migrations/1791000006450-AddZitadelSessionRefreshToken';
import { ZITADEL_ENTITIES } from './entities';
import { ZitadelTokenSubscriber } from './subscribers/zitadel-token.subscriber';

/**
 * The plugin's own migrations, oldest first (ordered with the platform's by their timestamps). The plugin's tables
 * themselves are created by the core migration listed in `MIGRATIONS.md`, which runs before these.
 */
export const AUTH_ZITADEL_MIGRATIONS = [AddZitadelSessionRefreshToken1791000006450];

/**
 * Ever ID as an additional sign-in method.
 *
 * Loaded by the API only with `ZITADEL_ENABLED=true` (see `isZitadelEnabled`). Unset, nothing of it
 * exists at runtime: no route, no timer, no outbound request. Every existing sign-in method is
 * unchanged either way.
 */
@Plugin({
	imports: [AuthZitadelModule],
	entities: [...ZITADEL_ENTITIES],
	migrations: [...AUTH_ZITADEL_MIGRATIONS],
	// Binds each Ever ID session to the refresh token of its sign-in (see ZitadelSessionService).
	subscribers: [ZitadelTokenSubscriber]
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
