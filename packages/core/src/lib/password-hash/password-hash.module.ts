import { Module, Global } from '@nestjs/common';
import { PasswordHashService } from './password-hash.service';
import { BcryptHashStrategy, ScryptHashStrategy } from './strategies';
import { PASSWORD_HASH_STRATEGIES, DEFAULT_PASSWORD_HASH_STRATEGY } from './interfaces';

/**
 * Global module providing password hashing services.
 * Uses scrypt for new hashes, bcrypt for legacy compatibility.
 */
@Global()
@Module({
	providers: [
		BcryptHashStrategy,
		ScryptHashStrategy,
		{
			provide: PASSWORD_HASH_STRATEGIES,
			useFactory: (bcrypt: BcryptHashStrategy, scrypt: ScryptHashStrategy) => [bcrypt, scrypt],
			inject: [BcryptHashStrategy, ScryptHashStrategy]
		},
		{ provide: DEFAULT_PASSWORD_HASH_STRATEGY, useExisting: ScryptHashStrategy },
		PasswordHashService
	],
	exports: [PasswordHashService, PASSWORD_HASH_STRATEGIES, DEFAULT_PASSWORD_HASH_STRATEGY]
})
export class PasswordHashModule {}
