import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { SocialAuthModule } from '@gauzy/auth';
import {
	Organization,
	User,
	UserOrganization
} from './../core/entities/internal';
import { EmailModule, EmailService } from '../email';
import { UserService } from '../user/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { JwtStrategy } from './jwt.strategy';
import { UserOrganizationService } from '../user-organization/user-organization.services';

const providers = [
	AuthService,
	UserService,
	UserOrganizationService,
	EmailService
];
@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/auth',
				module: AuthModule,
				children: [{ path: '/', module: SocialAuthModule }]
			}
		]),
		SocialAuthModule.registerAsync({
			imports: [AuthModule, CqrsModule],
			useClass: AuthService
		}),
		TypeOrmModule.forFeature([User, UserOrganization, Organization]),
		EmailModule,
		CqrsModule
	],
	controllers: [AuthController],
	providers: [...providers, ...CommandHandlers, JwtStrategy],
	exports: [...providers]
})
export class AuthModule {}
