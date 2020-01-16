import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { RoleService, Role } from '../role';
import { GoogleStrategy } from './google.strategy';
import { authenticate } from 'passport';
import { FacebookStrategy } from './facebook.strategy';
import { EmailService } from '../email-templates/email.service';
import { EmailModule, EmailTemplate } from '../email-templates';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, Role, EmailTemplate]),
		CqrsModule,
		EmailModule
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		UserService,
		EmailService,
		RoleService,
		...CommandHandlers,
		GoogleStrategy,
		FacebookStrategy
	],
	exports: [AuthService]
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
