import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { SocialAuthModule } from '@gauzy/auth';
import { EventBusModule } from '../event-bus/event-bus.module';
import { EmailSendModule } from '../email-send/email-send.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { JwtRefreshTokenStrategy, JwtStrategy } from './strategies';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { UserModule } from '../user/user.module';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from '../role/role.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationController } from './email-verification.controller';
import { FeatureModule } from '../feature/feature.module';
import { SocialAccountModule } from './social-account/social-account.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';

// Core service providers for handling authentication and related functionalities
const providers = [AuthService, EmailConfirmationService, UserOrganizationService];

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
				EventBusModule
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
		EventBusModule
	],
	controllers: [AuthController, EmailVerificationController],
	providers: [...providers, ...CommandHandlers, ...strategies],
	exports: [...providers]
})
export class AuthModule {}
