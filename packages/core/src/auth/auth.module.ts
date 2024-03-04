import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { SocialAuthModule } from '@gauzy/auth';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Organization, OrganizationTeam, UserOrganization } from './../core/entities/internal';
import { EmailSendModule } from './../email-send/email-send.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { JwtRefreshTokenStrategy, JwtStrategy } from './strategies';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { PasswordResetModule } from './../password-reset/password-reset.module';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationController } from './email-verification.controller';
import { FeatureModule } from './../feature/feature.module';
import { OrganizationModule } from '../organization/organization.module';

const providers = [AuthService, EmailConfirmationService, UserOrganizationService];

const strategies = [JwtStrategy, JwtRefreshTokenStrategy];

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/auth',
				module: AuthModule,
				children: [
					{
						path: '/',
						module: SocialAuthModule
					}
				]
			}
		]),
		SocialAuthModule.registerAsync({
			imports: [
				TypeOrmModule.forFeature([OrganizationTeam]),
				MikroOrmModule.forFeature([OrganizationTeam]),
				AuthModule,
				EmailSendModule,
				UserModule,
				RoleModule,
				PasswordResetModule,
				CqrsModule
			],
			useClass: AuthService
		}),
		TypeOrmModule.forFeature([UserOrganization, Organization, OrganizationTeam]),
		MikroOrmModule.forFeature([UserOrganization, Organization, OrganizationTeam]),
		EmailSendModule,
		UserModule,
		RoleModule,
		PasswordResetModule,
		FeatureModule,
		OrganizationModule,
		CqrsModule
	],
	controllers: [AuthController, EmailVerificationController],
	providers: [...providers, ...CommandHandlers, ...strategies],
	exports: [...providers]
})
export class AuthModule { }
