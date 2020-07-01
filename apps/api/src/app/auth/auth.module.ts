import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { authenticate } from 'passport';
import { EmailModule, EmailService } from '../email';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { FacebookStrategy } from './facebook.strategy';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { Organization } from '../organization/organization.entity';
import { GithubAuthGuard } from './guard/github-auth-guard';
import { MicrosoftAuthGuard } from './guard/microsoft-auth-guard';
import { MicrosoftStrategy } from './microsoft.strategy';
import { LinkedinStrategy } from './linkedin.strategy';
import { LinkedinAuthGuard } from './guard/linkedin-auth-guard';
import { TwitterAuthGuard } from './guard/twitter-auth-guard';

@Module({
	imports: [
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
		GoogleStrategy,
		FacebookStrategy,
		JwtStrategy,
		GithubAuthGuard,
		MicrosoftAuthGuard,
		MicrosoftStrategy,
		LinkedinStrategy,
		LinkedinAuthGuard,
		TwitterAuthGuard
	],
	exports: [AuthService, UserService]
})
export class AuthModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer
			.apply(
				authenticate('facebook', {
					session: false,
					scope: ['email']
				})
			)
			.forRoutes('auth/facebook/token');
	}
}
