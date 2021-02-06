import { Module } from '@nestjs/common';
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
export class SocialAuthModule {}
