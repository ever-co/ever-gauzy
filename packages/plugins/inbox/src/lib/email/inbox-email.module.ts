import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INBOX_EMAIL_PROVIDER_REGISTRY } from '@gauzy/contracts';
import { RolePermissionModule } from '@gauzy/core';
import { InboxProviderAccount } from './entities/inbox-provider-account.entity';
import { createInboxSecretBox, INBOX_SECRET_BOX } from './inbox-email.constants';
import { InboxEmailScopeService } from './inbox-email-scope.service';
import { InboxProviderAccountController } from './provider-accounts/inbox-provider-account.controller';
import { InboxProviderAccountService } from './provider-accounts/inbox-provider-account.service';
import { EmailProviderRegistry } from './providers/email-provider.registry';
import { InboxEmailTransportResolver } from './transport/inbox-email-transport.resolver';

/** Every table the Inbox email features own (their migrations create them). */
export const INBOX_EMAIL_ENTITIES = [InboxProviderAccount];

/**
 * The Inbox email features (plan 04 §5, Phase 4): provider plugins and their accounts, the transport the core
 * email seam sends through, and (next) mailboxes and the inbound pipeline. Loaded only when both
 * `GAUZY_INBOX_ENABLED` and `GAUZY_INBOX_EMAIL_ENABLED` are `true`.
 *
 * Global, so the email provider plugins (`@gauzy/plugin-email-provider-*`) reach the registry through the
 * `INBOX_EMAIL_PROVIDER_REGISTRY` token with `@Optional() @Inject(…)`, without importing this package and without
 * failing when the Inbox email features are off.
 */
@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature(INBOX_EMAIL_ENTITIES),
		MikroOrmModule.forFeature(INBOX_EMAIL_ENTITIES),
		// The tenant and permission guards of the routes need the role permissions.
		RolePermissionModule
	],
	controllers: [InboxProviderAccountController],
	providers: [
		EmailProviderRegistry,
		{ provide: INBOX_EMAIL_PROVIDER_REGISTRY, useExisting: EmailProviderRegistry },
		{ provide: INBOX_SECRET_BOX, useFactory: createInboxSecretBox },
		InboxEmailScopeService,
		InboxProviderAccountService,
		InboxEmailTransportResolver
	],
	exports: [EmailProviderRegistry, INBOX_EMAIL_PROVIDER_REGISTRY, InboxProviderAccountService]
})
export class InboxEmailModule {}
