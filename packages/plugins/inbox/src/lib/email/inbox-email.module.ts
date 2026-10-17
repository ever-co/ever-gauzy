import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INBOUND_ADDRESS_NAMESPACE, INBOX_EMAIL_HANDOFFS, INBOX_EMAIL_PROVIDER_REGISTRY } from '@gauzy/contracts';
import { EmailSendModule, RolePermissionModule } from '@gauzy/core';
import { InboxEmailController } from './emails/inbox-email.controller';
import { InboxEmailService } from './emails/inbox-email.service';
import { InboxEmailHandoffs } from './handoff/inbox-email-handoffs';
import { InboxEmail } from './entities/inbox-email.entity';
import { InboxEmailAttachment } from './entities/inbox-email-attachment.entity';
import { InboxEmailThread } from './entities/inbox-email-thread.entity';
import { InboxMailbox } from './entities/inbox-mailbox.entity';
import { InboxMailboxMember } from './entities/inbox-mailbox-member.entity';
import { InboxOrganizationSetting } from './entities/inbox-organization-setting.entity';
import { InboxProviderAccount } from './entities/inbox-provider-account.entity';
import { InboundRawBodyMiddleware } from './inbound/inbound-raw-body.middleware';
import { InboxEmailProcessor } from './inbound/inbox-email.processor';
import { INBOX_EMAIL_PROCESSOR } from './inbound/inbox-email-processor.types';
import { InboxEmailStorage } from './inbound/inbox-email-storage';
import { InboxInboundController, InboxInboundRateLimitGuard } from './inbound/inbox-inbound.controller';
import { InboxInboundService } from './inbound/inbox-inbound.service';
import { InboundReplayGuard } from './inbound/replay-guard.service';
import { createInboxSecretBox, INBOX_SECRET_BOX } from './inbox-email.constants';
import { InboxEmailScopeService } from './inbox-email-scope.service';
import { InboxMailboxAccessService } from './mailboxes/inbox-mailbox-access.service';
import { InboxMailboxController } from './mailboxes/inbox-mailbox.controller';
import { InboxMailboxProvisioner } from './mailboxes/inbox-mailbox.provisioner';
import { InboxMailboxService } from './mailboxes/inbox-mailbox.service';
import { InboxProviderAccountController } from './provider-accounts/inbox-provider-account.controller';
import { InboxProviderAccountService } from './provider-accounts/inbox-provider-account.service';
import { EmailProviderRegistry } from './providers/email-provider.registry';
import { GenericWebhookProvider } from './providers/generic/generic-webhook.provider';
import { InboxEmailTransportResolver } from './transport/inbox-email-transport.resolver';

/** Every table the Inbox email features own (their migrations create them). */
export const INBOX_EMAIL_ENTITIES = [
	InboxProviderAccount,
	InboxMailbox,
	InboxMailboxMember,
	InboxEmailThread,
	InboxEmail,
	InboxEmailAttachment,
	InboxOrganizationSetting
];

/**
 * The Inbox email features (plan 04 §5, Phase 4): provider plugins and their accounts, the transport the core
 * email seam sends through, mailboxes, the provider webhook and the inbound worker, and the stored messages' API
 * (read, raw, attachments, reply, forward, quarantine). Loaded only when both `GAUZY_INBOX_ENABLED` and
 * `GAUZY_INBOX_EMAIL_ENABLED` are `true`.
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
		RolePermissionModule,
		// Replies and forwards go out through the core transport seam (`EmailSendService.sendMessage`).
		EmailSendModule
	],
	controllers: [InboxProviderAccountController, InboxInboundController, InboxEmailController, InboxMailboxController],
	providers: [
		EmailProviderRegistry,
		{ provide: INBOX_EMAIL_PROVIDER_REGISTRY, useExisting: EmailProviderRegistry },
		{ provide: INBOX_SECRET_BOX, useFactory: createInboxSecretBox },
		InboxEmailScopeService,
		InboxProviderAccountService,
		InboxEmailTransportResolver,
		InboundReplayGuard,
		GenericWebhookProvider,
		InboxMailboxAccessService,
		InboxEmailStorage,
		InboxEmailProcessor,
		{ provide: INBOX_EMAIL_PROCESSOR, useExisting: InboxEmailProcessor },
		InboxInboundService,
		InboxInboundRateLimitGuard,
		InboxEmailService,
		InboxMailboxService,
		InboxMailboxProvisioner,
		// One address namespace: the Docs plugin asks it before it takes a capture address.
		{ provide: INBOUND_ADDRESS_NAMESPACE, useExisting: InboxMailboxService },
		// The hand-off seam (P4c): plugins that route a mailbox elsewhere (the Ever Works agent bridge).
		InboxEmailHandoffs,
		{ provide: INBOX_EMAIL_HANDOFFS, useExisting: InboxEmailHandoffs }
	],
	exports: [
		EmailProviderRegistry,
		INBOX_EMAIL_PROVIDER_REGISTRY,
		InboxProviderAccountService,
		InboxMailboxAccessService,
		InboundReplayGuard,
		InboxMailboxService,
		INBOUND_ADDRESS_NAMESPACE,
		InboxEmailHandoffs,
		INBOX_EMAIL_HANDOFFS
	]
})
export class InboxEmailModule implements NestModule {
	/** The webhook route keeps the raw bytes of the bodies the API's parsers leave unread (multipart forms, SNS text). */
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(InboundRawBodyMiddleware).forRoutes(InboxInboundController);
	}
}
