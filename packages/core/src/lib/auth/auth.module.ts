import { SocialAuthModule } from '@gauzy/auth';
import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AccessTokenModule } from '../access-token/access-token.module';
import { EmailSendModule } from '../email-send/email-send.module';
import { EmployeeModule } from '../employee/employee.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FeatureModule } from '../feature/feature.module';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { OrganizationModule } from '../organization/organization.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from '../role/role.module';
// The tenant entity and its repositories, not TenantModule: TenantModule imports this module. They answer
// RegistrationPolicyService's one question (does the installation have a tenant yet).
import { Tenant } from '../tenant/tenant.entity';
import { TypeOrmTenantRepository } from '../tenant/repository/type-orm-tenant.repository';
import { MikroOrmTenantRepository } from '../tenant/repository/mikro-orm-tenant.repository';
// Deep path, not the '../shared/billing' barrel. The barrel re-exports BillingModule, which
// imports TenantModule, which imports this module — so importing the barrel here closes a
// require cycle (billing.module -> tenant.module -> auth.module -> billing/index ->
// billing.module). TenantModule is then still mid-evaluation when BillingModule's @Module()
// decorator runs, and its imports array gets `undefined` where TenantModule should be, which
// Nest rejects at boot on every deployment — including self-hosted installs that never
// configure Stripe. tenant.module.ts imports this service by the deep path for the same reason.
import { StripeSubscriptionService } from '../shared/billing/stripe-subscription.service';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { RegistrationPolicyService } from './auth-switches';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationController } from './email-verification.controller';
import { LoginAttemptModule } from './login-attempt.module';
import { SocialAccountModule } from './social-account/social-account.module';
import { OAuthClientModule } from './oauth-client/oauth-client.module';
import { TermsAcceptanceModule } from '../terms-acceptance/terms-acceptance.module';
import { AuthenticatedUserCacheProvider, JwtRefreshTokenStrategy, JwtStrategy } from './strategies';

// Core service providers for handling authentication and related functionalities
const providers = [
	AuthService,
	EmailConfirmationService,
	UserOrganizationService,
	// Backs SubscriptionRequiredGuard on the register route. Inert unless STRIPE_SECRET_KEY is set,
	// so self-hosted installs are unaffected by its presence here.
	StripeSubscriptionService,
	// The operator's registration switches (APP_USER_REGISTRATION, ALLOW_TENANTS_REGISTRATION): backs
	// SelfRegistrationGuard here and the tenant creation check in TenantModule, which imports this module.
	RegistrationPolicyService
];

// Authentication strategies for token validation and management
const strategies = [AuthenticatedUserCacheProvider, JwtStrategy, JwtRefreshTokenStrategy];

@Module({
	imports: [
		SocialAuthModule.registerAsync({
			imports: [
				HttpModule,
				AuthModule,
				EmailSendModule,
				UserModule,
				forwardRef(() => UserOrganizationModule),
				EmployeeModule,
				RoleModule,
				OrganizationModule,
				OrganizationTeamModule,
				PasswordResetModule,
				CqrsModule,
				SocialAccountModule,
				EventBusModule,
				RolePermissionModule,
				AccessTokenModule,
				RefreshTokenModule,
				OAuthClientModule,
				TermsAcceptanceModule,
				LoginAttemptModule
			],
			useClass: AuthService
		}),
		TypeOrmModule.forFeature([Tenant]),
		MikroOrmModule.forFeature([Tenant]),
		EmailSendModule,
		UserModule,
		forwardRef(() => UserOrganizationModule),
		EmployeeModule,
		RoleModule,
		OrganizationModule,
		OrganizationTeamModule,
		PasswordResetModule,
		FeatureModule,
		CqrsModule,
		SocialAccountModule,
		EventBusModule,
		RolePermissionModule,
		AccessTokenModule,
		RefreshTokenModule,
		OAuthClientModule,
		TermsAcceptanceModule,
		LoginAttemptModule
	],
	controllers: [AuthController, EmailVerificationController],
	providers: [
		...providers,
		...CommandHandlers,
		...EventHandlers,
		...strategies,
		TypeOrmTenantRepository,
		MikroOrmTenantRepository
	],
	// The validated-context cache is exported so an off-boarding write can `forget` a user from another module.
	exports: [...providers, AuthenticatedUserCacheProvider]
})
export class AuthModule {}
