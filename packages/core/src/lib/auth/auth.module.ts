import { SocialAuthModule } from '@gauzy/auth';
import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
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
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationController } from './email-verification.controller';
import { SocialAccountModule } from './social-account/social-account.module';
import { OAuthClientModule } from './oauth-client/oauth-client.module';
import { TermsAcceptanceModule } from '../terms-acceptance/terms-acceptance.module';
import { JwtRefreshTokenStrategy, JwtStrategy } from './strategies';

// Core service providers for handling authentication and related functionalities
const providers = [
	AuthService,
	EmailConfirmationService,
	UserOrganizationService,
	// Backs SubscriptionRequiredGuard on the register route. Inert unless STRIPE_SECRET_KEY is set,
	// so self-hosted installs are unaffected by its presence here.
	StripeSubscriptionService
];

// Authentication strategies for token validation and management
const strategies = [JwtStrategy, JwtRefreshTokenStrategy];

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
				TermsAcceptanceModule
			],
			useClass: AuthService
		}),
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
		TermsAcceptanceModule
	],
	controllers: [AuthController, EmailVerificationController],
	providers: [...providers, ...CommandHandlers, ...strategies],
	exports: [...providers]
})
export class AuthModule {}
