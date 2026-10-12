import { Module } from '@nestjs/common';
import { LoginAttemptService } from './login-attempt.service';

/**
 * Standalone home for {@link LoginAttemptService}.
 *
 * Kept out of `AuthModule` so that modules which verify a credential of their own — the team
 * join-request code, for instance — can use the counter without importing the whole auth graph and
 * closing a require cycle. Its only dependency is the optional, globally registered `EVER_REDIS_CLIENT`.
 */
@Module({
	providers: [LoginAttemptService],
	exports: [LoginAttemptService]
})
export class LoginAttemptModule {}
