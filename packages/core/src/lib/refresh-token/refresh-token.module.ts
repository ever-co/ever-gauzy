import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenModule } from '../token/token.module';
import { CURRENT_USER_PROVIDER, RequestContextCurrentUserProvider } from './current-user.provider';
import { refreshTokenReuseWindowMs } from './refresh-token-reuse-window';
import { RefreshTokenService } from './refresh-token.service';
import { JWT_REFRESH_TOKEN, REFRESH_TOKEN, REFRESH_TOKEN_TYPE } from './type.token';

@Module({
	imports: [
		TokenModule.forFeatureAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			jwtSecret: (configService: ConfigService) => configService.getOrThrow('JWT_REFRESH_TOKEN_SECRET'),
			useFactory: (configService: ConfigService) => ({
				tokenType: REFRESH_TOKEN_TYPE,
				expiration:
					Number(configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME')) * 1000 ||
					30 * 24 * 60 * 60 * 1000, // 30 days
				threshold: 7 * 24 * 60 * 60 * 1000, // 7 days
				allowRotation: true,
				allowMultipleSessions: true,
				// A refresh token just rotated is answered again for a few seconds (ever-co/ever-gauzy#11955)
				rotationReuseWindow: refreshTokenReuseWindowMs(
					configService.get<string>('JWT_REFRESH_TOKEN_REUSE_WINDOW')
				)
			}),
			jwtServiceToken: JWT_REFRESH_TOKEN,
			serviceToken: REFRESH_TOKEN
		})
	],
	providers: [
		RefreshTokenService,
		RequestContextCurrentUserProvider,
		{
			provide: CURRENT_USER_PROVIDER,
			useExisting: RequestContextCurrentUserProvider
		}
	],
	exports: [RefreshTokenService]
})
export class RefreshTokenModule {}
