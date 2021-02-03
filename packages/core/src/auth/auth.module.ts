import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
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

@Module({
	imports: [
		SocialAuthModule,
		TypeOrmModule.forFeature([User, UserOrganization, Organization]),
		EmailModule,
		CqrsModule
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		UserService,
		UserOrganizationService,
		EmailService,
		...CommandHandlers,
		JwtStrategy
	],
	exports: [AuthService, UserService]
})
export class AuthModule {}
