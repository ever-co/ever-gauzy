import { Logger, Module } from '@nestjs/common';
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
import { ZitadelHandoffThrottleGuard } from './guards/zitadel-handoff-throttle.guard';
import { ZitadelRetryAfterInterceptor } from './http/zitadel-retry';
import { GAUZY_AUTH } from './ports/gauzy-auth.port';
import { TERMS_DOCUMENTS } from './ports/terms-documents.port';
import { ZitadelAccountService } from './services/zitadel-account.service';
import { ZitadelBackchannelService } from './services/zitadel-backchannel.service';
import { ZitadelClaimsService } from './services/zitadel-claims.service';
import { ZitadelConfigService } from './services/zitadel-config.service';
import { ZitadelEventsService } from './services/zitadel-events.service';
import { ZitadelFlowService } from './services/zitadel-flow.service';
import { ZitadelLinkService } from './services/zitadel-link.service';
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
	ZitadelEventsService,
	ZitadelSubscriptionGateService,
	ZitadelSignupService,
	ZitadelSigninService,
	ZitadelLinkService,
	ZitadelFlowService,
	ZitadelTokenSigninService,
	ZitadelBackchannelService,
	ZitadelConfiguredGuard,
	ZitadelHandoffThrottleGuard,
	ZitadelRetryAfterInterceptor
];

/**
 * Ever ID sign-in: routes under `/api/auth/zitadel`, built on the shared OIDC library of
 * `@gauzy/auth`. Gauzy's own authentication service provides the e-mail code, the register path and
 * the subscription gate, so those rules stay Gauzy's own.
 */
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
		...AUTH_ZITADEL_SERVICES
	]
})
export class AuthZitadelModule {}
