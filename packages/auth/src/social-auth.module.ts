import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { authenticate } from 'passport';
import { ConfigModule } from '@gauzy/config';
import { Strategies } from './strategies';
import { AuthGuards } from './guards';
import { SocialAuthService } from './social-auth.service';

@Module({
	imports: [ConfigModule],
	controllers: [],
	providers: [...Strategies, ...AuthGuards, SocialAuthService],
	exports: [SocialAuthService]
})
export class SocialAuthModule implements NestModule {
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
