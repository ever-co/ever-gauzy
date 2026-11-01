import { DynamicModule, Inject, Injectable, Logger, Module, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { EventBusModule, RolePermissionModule } from '@gauzy/core';
import { EVER_CONNECT_CONFIG } from '@gauzy/plugin-auth-zitadel';
import { EverInstanceModule, EverInstanceService, EverOperatorService } from '@gauzy/plugin-ever-instance';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { EverConnectCatalogService } from './ever-connect-catalog.service';
import { EverConnectCleanupService } from './ever-connect-cleanup.service';
import { readEverConnectConfig } from './ever-connect-config';
import { EVER_CONNECT_CONFIG_PROVIDER } from './ever-connect-config.provider';
import { EverConnectConnectionService } from './ever-connect-connection.service';
import { EVER_CONNECT_ENV, EVER_CONNECT_SETTINGS } from './ever-connect.constants';
import { EverConnectController } from './ever-connect.controller';
import { isEverConnectEnabled } from './ever-connect-enabled';
import { EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectHealthController } from './ever-connect-health.controller';
import { EverConnectIdentityStore } from './ever-connect-identity.store';
import { EverConnectIdentityWorker } from './ever-connect-identity.worker';
import { EverConnectInstanceController } from './ever-connect-instance.controller';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import { EverConnectLease } from './ever-connect-lease';
import { EverConnectLinkService } from './ever-connect-link.service';
import { EverConnectPlatformService, errorCode } from './ever-connect-platform.service';
import { EverConnectScheduler } from './ever-connect-scheduler.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore } from './ever-connect.store';
import { EverConnectEnabledGuard, EverConnectOperatorGuard } from './guards/ever-connect-operator.guard';
import { EverIdLoginHandler } from './handlers/ever-id-login.handler';
import { PersonDeletionHandler } from './handlers/person-deletion.handler';
import { PersonExportHandler } from './handlers/person-export.handler';
import { PersonRequestsHandler } from './handlers/person-requests.handler';
import { PersonLinkReporter } from './reporters/person-link.reporter';
import { EverConnectWellKnownService } from './well-known/ever-connect-well-known.service';

/**
 * Lists "Ever Platform" among the integrations, pins the operator of a single-tenant installation,
 * and picks up an existing connection (or uses `EVER_CONNECT_CODE` once) when the API is up.
 * Without a connection it sends nothing and schedules nothing.
 *
 * It reads `EVER_CONNECT_ENABLED` again first: when the module was loaded although the switch is no
 * longer `true` (a settings file read after the plugin list was built), it does nothing at all.
 */
@Injectable()
export class EverConnectLifecycle implements OnApplicationBootstrap {
	private readonly logger = new Logger('EverConnect');
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly instance: EverInstanceService,
		private readonly operator: EverOperatorService,
		private readonly catalog: EverConnectCatalogService,
		private readonly connection: EverConnectConnectionService,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	async onApplicationBootstrap(): Promise<void> {
		if (!isEverConnectEnabled(this.env)) {
			return;
		}
		try {
			await this.catalog.ensure();
			await this.instance.ensure();
			await this.operator.pinFirstSuperAdmin();
			await this.connection.start();
			this.logger.log('The Ever Platform connection module is loaded (EVER_CONNECT_ENABLED=true).');
		} catch (error) {
			// Never stop the API: without its tables the module stays idle and its routes answer errors.
			this.logger.warn(`The Ever Platform connection could not start (${errorCode(error)}); nothing is sent.`);
		}
	}
}

/**
 * The Ever Platform connection module. `register()` reads the environment once; the health route
 * for a paired Ever Teams web app is mounted only when `EVER_STATS_SERVES` names `teams`.
 *
 * Global so that the Ever ID sign-in plugin finds `EVER_CONNECT_CONFIG` (Sign in with Ever ID's
 * client), which it asks optionally; the module's other providers stay its own.
 */
@Module({})
export class EverConnectModule {
	static register(env: Record<string, string | undefined> = process.env): DynamicModule {
		const logger = new Logger('EverConnect');
		// The plugin list imports this module even when it is not loaded: its settings warn only when it is.
		const config = readEverConnectConfig(env, (message) =>
			isEverConnectEnabled(env, () => undefined) ? logger.warn(message) : undefined
		);
		return {
			module: EverConnectModule,
			global: true,
			// Gauzy's tenant and permission guards of the organization routes need the role permissions;
			// the event bus carries the Ever ID sign-in plugin's link events.
			imports: [EverInstanceModule, RolePermissionModule, EventBusModule],
			controllers: [
				EverConnectController,
				EverConnectInstanceController,
				...(config.serves.includes('teams') ? [EverConnectHealthController] : [])
			],
			providers: [
				{ provide: EVER_CONNECT_SETTINGS, useValue: config },
				{ provide: EVER_CONNECT_ENV, useValue: env },
				EverConnectSignals,
				EverConnectStore,
				EverConnectAuditService,
				EverConnectCatalogService,
				EverConnectPlatformService,
				EverConnectEntitlementService,
				EverConnectIntegrationStateService,
				EverConnectLinkService,
				EverConnectCleanupService,
				EverConnectConnectionService,
				EverConnectLease,
				EverConnectIdentityStore,
				EverIdLoginHandler,
				EVER_CONNECT_CONFIG_PROVIDER,
				PersonLinkReporter,
				PersonDeletionHandler,
				PersonExportHandler,
				PersonRequestsHandler,
				EverConnectIdentityWorker,
				EverConnectWellKnownService,
				EverConnectScheduler,
				EverConnectOperatorGuard,
				EverConnectEnabledGuard,
				EverConnectLifecycle
			],
			exports: [EverConnectConnectionService, EverConnectIntegrationStateService, EVER_CONNECT_CONFIG]
		};
	}
}
