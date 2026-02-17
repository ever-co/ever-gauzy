import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenModule } from '../token/token.module';
import { AccessTokenService } from './access-token.service';
import { ACCESS_TOKEN, ACCESS_TOKEN_TYPE, JWT_ACCESS_TOKEN } from './type.token';

@Module({
	imports: [
		TokenModule.forFeatureAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			jwtSecret: (configService: ConfigService) => configService.getOrThrow('JWT_SECRET'),
			useFactory: (configService: ConfigService) => ({
				tokenType: ACCESS_TOKEN_TYPE,
				expiration:
					Number(configService.get<string>('JWT_TOKEN_EXPIRATION_TIME')) * 1000 || 1 * 24 * 60 * 60 * 1000, // 1 day
				threshold: 7 * 24 * 60 * 60 * 1000, // 7 days
				allowRotation: false,
				allowMultipleSessions: true
			}),
			serviceToken: ACCESS_TOKEN,
			jwtServiceToken: JWT_ACCESS_TOKEN
		})
	],
	providers: [AccessTokenService],
	exports: [AccessTokenService]
})
export class AccessTokenModule {}
