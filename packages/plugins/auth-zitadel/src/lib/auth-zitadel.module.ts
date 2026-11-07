import { Global, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OidcModule } from '@gauzy/auth';
import {
	AuthModule,
	AuthService,
	EventBusModule,
	SocialAccount,
	SubscriptionRequiredGuard,
	TermsAcceptanceModule,
	TermsAcceptanceService,
	Token,
	User
} from '@gauzy/core';
import { AuthZitadelController } from './auth-zitadel.controller';
import { parseZitadelSettings } from './auth-zitadel.config';
import { AUTH_ZITADEL_SETTINGS } from './auth-zitadel.tokens';
import { ZITADEL_ENTITIES } from './entities';
import { ZitadelConfiguredGuard } from './guards/zitadel-configured.guard';
import { ZitadelPersonDataListener } from './handlers/person-deletion.listener';
import { ZitadelHandoffThrottleGuard } from './guards/zitadel-handoff-throttle.guard';
import { ZitadelRetryAfterInterceptor } from './http/zitadel-retry';
import { ZITADEL_PROVISIONER } from './ports/create-user-pre-linked.port';
import { EVER_ID_ACCOUNTS } from './ports/ever-id-accounts.port';
import { EVER_ID_SESSION_TOKENS } from './ports/ever-id-session-tokens.port';
import { ZITADEL_HANDOFF_READER } from './ports/handoff-reader.port';
import { GAUZY_AUTH } from './ports/gauzy-auth.port';
import { TERMS_DOCUMENTS } from './ports/terms-documents.port';
import { ZitadelAccountService } from './services/zitadel-account.service';
import { ZitadelBackchannelService } from './services/zitadel-backchannel.service';
import { ZitadelClaimsService } from './services/zitadel-claims.service';
import { ZitadelConfigService } from './services/zitadel-config.service';
import { ZitadelEventsService } from './services/zitadel-events.service';
import { ZitadelFlowService } from './services/zitadel-flow.service';
import { ZitadelHandoffService } from './services/zitadel-handoff.service';
import { ZitadelLinkService } from './services/zitadel-link.service';
import { ZitadelProvisionService } from './services/zitadel-provision.service';
import { ZitadelRefreshTokenService } from './services/zitadel-refresh-token.service';
import { ZitadelSessionService } from './services/zitadel-session.service';
import { ZitadelSigninService } from './services/zitadel-signin.service';
import { ZitadelSignupService } from './services/zitadel-signup.service';
import { ZitadelStoreService } from './services/zitadel-store.service';
import { ZitadelSubscriptionGateService } from './services/zitadel-subscription-gate.service';
import { ZitadelTokenSigninService } from './services/zitadel-token-signin.service';
import { ZitadelWorkspaceService } from './services/zitadel-workspace.service';

/** Settings are read once, when the module starts; each problem is logged once, without secrets. */
const settingsProvider = {
	provide: AUTH_ZITADEL_SETTINGS,
	useFactory: () => {
		const logger = new Logger('AuthZitadelPlugin');
		const settings = parseZitadelSettings(process.env, (message) => logger.warn(message));
		if (!settings.issuers.length || !settings.clientId || !settings.clientSecret) {
			logger.warn('Ever ID sign-in is loaded but not configured: set ZITADEL_ISSUERS, ZITADEL_CLIENT_ID and ZITADEL_CLIENT_SECRET.');
		}
		return settings;
	}
};

export const AUTH_ZITADEL_SERVICES = [
	ZitadelConfigService,
	ZitadelStoreService,
	ZitadelAccountService,
	ZitadelClaimsService,
	ZitadelWorkspaceService,
	ZitadelSessionService,
	ZitadelRefreshTokenService,
	ZitadelEventsService,
	ZitadelSubscriptionGateService,
	ZitadelSignupService,
	ZitadelSigninService,
	ZitadelLinkService,
	ZitadelHandoffService,
	ZitadelProvisionService,
	ZitadelFlowService,
	ZitadelTokenSigninService,
	ZitadelBackchannelService,
	ZitadelPersonDataListener,
	ZitadelConfiguredGuard,
	ZitadelHandoffThrottleGuard,
	ZitadelRetryAfterInterceptor
];

/**
 * Ever ID sign-in: routes under `/api/auth/zitadel`, built on the shared OIDC library of
 * `@gauzy/auth`. Gauzy's own authentication service provides the e-mail code, the register path and
 * the subscription gate, so those rules stay Gauzy's own.
 *
 * Global for its ports, which the Ever Platform connection plugin asks (optionally):
 * {@link EVER_ID_ACCOUNTS} when a person's deletion or export request names an Ever ID, and
 * {@link ZITADEL_HANDOFF_READER} with {@link ZITADEL_PROVISIONER} when a person confirms a workspace
 * Ever Platform asked this installation to create, and {@link EVER_ID_SESSION_TOKENS} for the App Launcher
 * (`EVER_APP_LAUNCHER_ENABLED=true`).
 */
@Global()
@Module({
	imports: [
		OidcModule,
		TypeOrmModule.forFeature([...ZITADEL_ENTITIES, User, SocialAccount, Token]),
		AuthModule,
		TermsAcceptanceModule,
		EventBusModule
	],
	controllers: [AuthZitadelController],
	providers: [
		settingsProvider,
		{ provide: GAUZY_AUTH, useExisting: AuthService },
		{ provide: TERMS_DOCUMENTS, useExisting: TermsAcceptanceService },
		SubscriptionRequiredGuard,
		...AUTH_ZITADEL_SERVICES,
		{ provide: EVER_ID_ACCOUNTS, useExisting: ZitadelPersonDataListener },
		{ provide: ZITADEL_HANDOFF_READER, useExisting: ZitadelHandoffService },
		{ provide: ZITADEL_PROVISIONER, useExisting: ZitadelProvisionService },
		{ provide: EVER_ID_SESSION_TOKENS, useExisting: ZitadelRefreshTokenService }
	],
	exports: [EVER_ID_ACCOUNTS, ZITADEL_HANDOFF_READER, ZITADEL_PROVISIONER, EVER_ID_SESSION_TOKENS]
})
export class AuthZitadelModule {}
