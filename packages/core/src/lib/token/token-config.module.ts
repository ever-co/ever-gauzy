import { Global, Module } from '@nestjs/common';
import { TokenConfigRegistry } from './token-config.registry';

@Global()
@Module({
	providers: [TokenConfigRegistry],
	exports: [TokenConfigRegistry]
})
export class TokenConfigModule {}
