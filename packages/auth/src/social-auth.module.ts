import { Module } from '@nestjs/common';
import { ConfigModule } from '@gauzy/config';
import { Strategies } from './strategies';
import { AuthGuards } from './guards';

@Module({
	imports: [ConfigModule],
	controllers: [],
	providers: [...Strategies, ...AuthGuards],
	exports: []
})
export class SocialAuthModule {}
