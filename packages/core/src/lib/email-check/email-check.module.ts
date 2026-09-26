import { Module } from '@nestjs/common';
import { TenantApiKeyModule } from '../tenant-api-key/tenant-api-key.module';
import { UserModule } from '../user/user.module';
import { EmailCheckController } from './email-check.controller';
import { EmailCheckResolver } from './email-check.resolver';
import { EmailCheckService } from './email-check.service';

/**
 * The email check.
 *
 * `TenantApiKeyModule` is imported for the guard rather than for a service: a guard is a provider of
 * whichever module hosts the handler it protects, and `ApiKeyAuthGuard` resolves the key store from it —
 * so the module that hosts the resolver has to reach it, exactly as the module that hosts the controller
 * does. The GraphQL view of the same operation is declared here beside the controller: a resolver can
 * only inject services its own module can reach, and this module is what reaches them.
 */
@Module({
	imports: [UserModule, TenantApiKeyModule],
	controllers: [EmailCheckController],
	providers: [EmailCheckService, EmailCheckResolver]
})
export class EmailCheckModule {}
