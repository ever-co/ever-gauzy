import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { SocialAuthModule } from '@gauzy/auth';
import { Organization, UserOrganization } from './../core/entities/internal';
import { EmailModule } from './../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { JwtStrategy } from './jwt.strategy';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { UserModule } from './../user/user.module';

const providers = [
	AuthService,
	UserOrganizationService
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
			imports: [
				AuthModule,
				EmailModule,
				UserModule,
				CqrsModule
			],
			useClass: AuthService
		}),
		TypeOrmModule.forFeature([UserOrganization, Organization]),
		EmailModule,
		UserModule,
		CqrsModule
	],
	controllers: [AuthController],
	providers: [...providers, ...CommandHandlers, JwtStrategy],
	exports: [...providers]
})
export class AuthModule {}
