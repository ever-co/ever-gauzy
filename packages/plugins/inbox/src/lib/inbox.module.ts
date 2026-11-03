import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	INBOX_ITEM_FEED,
	INBOX_ITEM_WRITER,
	INBOX_RECIPIENT_ACTIONS,
	INBOX_SOURCE_HANDLER_REGISTRY
} from '@gauzy/contracts';
import { RolePermissionModule } from '@gauzy/core';
import { InboxItem } from './entities/inbox-item.entity';
import { InboxItemRecipient } from './entities/inbox-item-recipient.entity';
import { InboxController } from './inbox.controller';
import { InboxResolver } from './graphql/inbox.resolver';
import { InboxItemFeed } from './inbox-item-feed';
import { InboxService } from './inbox.service';
import { InboxSourceHandlerRegistry } from './inbox-source-handler.registry';
import { InboxRealtime } from './realtime/inbox-realtime';

/** Every table the plugin owns (its migrations create them). */
export const INBOX_ENTITIES = [InboxItem, InboxItemRecipient];

/**
 * The Inbox module (`@gauzy/plugin-inbox`), loaded only when `GAUZY_INBOX_ENABLED=true`.
 *
 * Global, so the plugins that feed the inbox reach its registry and writer through the
 * `INBOX_SOURCE_HANDLER_REGISTRY` / `INBOX_ITEM_WRITER` tokens with `@Optional() @Inject(…)` — without
 * importing this package, and without failing when the inbox is off. Plugins that mirror it elsewhere observe it
 * the same way (`INBOX_ITEM_FEED`, `INBOX_RECIPIENT_ACTIONS`).
 */
@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature(INBOX_ENTITIES),
		MikroOrmModule.forFeature(INBOX_ENTITIES),
		// The tenant and permission guards of the routes need the role permissions.
		// (The resolver's GraphQL capability gate, `FeatureFlagGuard`, reads the global `FeatureModule`.)
		RolePermissionModule
	],
	controllers: [InboxController],
	providers: [
		InboxSourceHandlerRegistry,
		InboxService,
		// Listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is never
		// registered, and the schema would advertise fields nothing resolves.
		InboxResolver,
		// Real time (G-P3-6): `inbox_item.created` appended to the outbox and streamed to the recipients.
		InboxRealtime,
		// The observer seam (plugins that mirror the Inbox elsewhere) and the recipient actions they apply as the user.
		InboxItemFeed,
		{ provide: INBOX_SOURCE_HANDLER_REGISTRY, useExisting: InboxSourceHandlerRegistry },
		{ provide: INBOX_ITEM_WRITER, useExisting: InboxService },
		{ provide: INBOX_ITEM_FEED, useExisting: InboxItemFeed },
		{ provide: INBOX_RECIPIENT_ACTIONS, useExisting: InboxService }
	],
	exports: [
		InboxSourceHandlerRegistry,
		InboxService,
		InboxItemFeed,
		INBOX_SOURCE_HANDLER_REGISTRY,
		INBOX_ITEM_WRITER,
		INBOX_ITEM_FEED,
		INBOX_RECIPIENT_ACTIONS
	]
})
export class InboxModule {}
