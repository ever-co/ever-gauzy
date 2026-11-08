import { DynamicModule, Inject, Injectable, Logger, Module, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { EventBusModule, RolePermissionModule } from '@gauzy/core';
import { EVER_CONNECT_CONFIG, EVER_ID_TOKEN_VAULT } from '@gauzy/plugin-auth-zitadel';
import { EverInstanceModule, EverInstanceService, EverOperatorService } from '@gauzy/plugin-ever-instance';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { EverConnectCatalogService } from './ever-connect-catalog.service';
import { EverConnectCleanupService } from './ever-connect-cleanup.service';
import { readEverConnectConfig } from './ever-connect-config';
import { EVER_CONNECT_CONFIG_PROVIDER } from './ever-connect-config.provider';
import { EverConnectConnectionService } from './ever-connect-connection.service';
import { EVER_CONNECT_ENV, EVER_CONNECT_SETTINGS } from './ever-connect.constants';
import { EverConnectController } from './ever-connect.controller';
import { EverConnectDiscoverableService } from './ever-connect-discoverable.service';
import { isEverConnectEnabled } from './ever-connect-enabled';
import { EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectHealthController } from './ever-connect-health.controller';
import { EverConnectIdentityStore } from './ever-connect-identity.store';
import { EverConnectIdentityWorker } from './ever-connect-identity.worker';
import { EverConnectInstanceController } from './ever-connect-instance.controller';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import { EverConnectLease } from './ever-connect-lease';
import { EverConnectLinkService } from './ever-connect-link.service';
import { EverConnectLookupService } from './ever-connect-lookup.service';
import { EverConnectPlatformService, errorCode } from './ever-connect-platform.service';
import { EverConnectProvisionController } from './ever-connect-provision.controller';
import { EverConnectProvisionExceptionFilter } from './ever-connect-provision.filter';
import { EverConnectProvisionStore } from './ever-connect-provision.store';
import { EverConnectScheduler } from './ever-connect-scheduler.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore } from './ever-connect.store';
import { EverConnectEnabledGuard, EverConnectOperatorGuard } from './guards/ever-connect-operator.guard';
import { EverConnectProvisionGuard } from './guards/ever-connect-provision.guard';
import { EverIdLoginHandler } from './handlers/ever-id-login.handler';
import { PersonDeletionHandler } from './handlers/person-deletion.handler';
import { PersonExportHandler } from './handlers/person-export.handler';
import { PersonRequestsHandler } from './handlers/person-requests.handler';
import { IntegrationHandlerRegistry } from './integrations/integration-handler.registry';
import { PersonLinkReporter } from './reporters/person-link.reporter';
import { EverConnectIntentVerifier } from './services/ever-connect-intent-verifier.service';
import { EverConnectProvisionCompletion } from './services/ever-connect-provision-completion.service';
import { EverConnectProvisionGate } from './services/ever-connect-provision-gate.service';
import { EverConnectProvisionService } from './services/ever-connect-provision.service';
import { EverConnectWellKnownService } from './well-known/ever-connect-well-known.service';
import { EverConnectLauncherController } from './launcher/ever-connect-launcher.controller';
import { EverConnectLauncherService } from './launcher/ever-connect-launcher.service';
import { EverConnectLauncherTokenService } from './launcher/ever-connect-launcher-token.service';
import { EVER_CONNECT_LAUNCHER_SETTINGS, readLauncherConfig } from './launcher/launcher-config';
import { LauncherFirstPartyGuard } from './launcher/launcher-first-party.guard';
import { LauncherOriginGuard } from './launcher/launcher-origin.guard';
import { LauncherReads } from './launcher/launcher-reads';
import { LauncherTokenVault } from './launcher/launcher-token-vault';

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
 * for a paired Ever Teams web app is mounted only when `EVER_STATS_SERVES` names `teams`, and the App
 * Launcher's routes and services exist only with `EVER_APP_LAUNCHER_ENABLED=true` (with Ever ID sign-in
 * and the Ever Platform connection loaded): otherwise they are not registered at all, so their routes
 * answer 404 and no token encryption is exported.
 *
 * Global so that the Ever ID sign-in plugin finds `EVER_CONNECT_CONFIG` (Sign in with Ever ID's
 * client) and, with the App Launcher on, `EVER_ID_TOKEN_VAULT`, which it asks optionally; the module's
 * other providers stay its own.
 */
@Module({})
export class EverConnectModule {
	static register(env: Record<string, string | undefined> = process.env): DynamicModule {
		const logger = new Logger('EverConnect');
		// The plugin list imports this module even when it is not loaded: its settings warn only when it is.
		const config = readEverConnectConfig(env, (message) =>
			isEverConnectEnabled(env, () => undefined) ? logger.warn(message) : undefined
		);
		const launcher = readLauncherConfig(env, (message) =>
			isEverConnectEnabled(env, () => undefined) ? logger.warn(message) : undefined
		);
		const launcherProviders = launcher.enabled
			? [
					{ provide: EVER_CONNECT_LAUNCHER_SETTINGS, useValue: launcher },
					LauncherReads,
					EverConnectLauncherTokenService,
					EverConnectLauncherService,
					LauncherOriginGuard,
					LauncherFirstPartyGuard,
					LauncherTokenVault,
					// The Ever ID sign-in plugin asks for it (optionally) to encrypt the refresh token a session keeps.
					{ provide: EVER_ID_TOKEN_VAULT, useExisting: LauncherTokenVault }
				]
			: [];
		return {
			module: EverConnectModule,
			global: true,
			// Gauzy's tenant and permission guards of the organization routes need the role permissions;
			// the event bus carries the Ever ID sign-in plugin's link events.
			imports: [EverInstanceModule, RolePermissionModule, EventBusModule],
			controllers: [
				EverConnectController,
				EverConnectInstanceController,
				// Answers 404 unless EVER_CONNECT_PROVISION_ENABLED=true (see its guard).
				EverConnectProvisionController,
				...(config.serves.includes('teams') ? [EverConnectHealthController] : []),
				// Registered only with EVER_APP_LAUNCHER_ENABLED=true, Ever ID sign-in and the Ever Platform connection loaded.
				...(launcher.enabled ? [EverConnectLauncherController] : [])
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
				// The handlers of the integrations beyond the connection's own: an integration without one
				// reads "coming soon". The counterparty check and discoverability register themselves.
				IntegrationHandlerRegistry,
				EverConnectIntegrationStateService,
				EverConnectLookupService,
				EverConnectDiscoverableService,
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
				EverConnectProvisionStore,
				EverConnectIntentVerifier,
				EverConnectProvisionGate,
				EverConnectProvisionCompletion,
				EverConnectProvisionService,
				EverConnectProvisionGuard,
				EverConnectProvisionExceptionFilter,
				EverConnectScheduler,
				EverConnectOperatorGuard,
				EverConnectEnabledGuard,
				EverConnectLifecycle,
				...launcherProviders
			],
			exports: [
				EverConnectConnectionService,
				EverConnectIntegrationStateService,
				EVER_CONNECT_CONFIG,
				...(launcher.enabled ? [EVER_ID_TOKEN_VAULT] : [])
			]
		};
	}
}
