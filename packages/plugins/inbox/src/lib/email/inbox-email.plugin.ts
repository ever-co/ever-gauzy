import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { INBOX_EMAIL_MIGRATIONS } from './database/inbox-email-migrations';
import { inboxEmailSchemaExtensions } from './graphql/inbox-email.schema';
import { InboxEmailMessageResolver } from './graphql/inbox-email-message.resolver';
import { InboxMailboxResolver } from './graphql/inbox-mailbox.resolver';
import { InboxProviderAccountResolver } from './graphql/inbox-provider-account.resolver';
import { INBOX_EMAIL_ENTITIES, InboxEmailModule } from './inbox-email.module';
import { InboxEmployeeCreatedSubscriber } from './mailboxes/inbox-employee.subscriber';

export { INBOX_EMAIL_MIGRATIONS };

/**
 * The Inbox email features (`@gauzy/plugin-inbox`, plan 04 §5, Phase 4): email provider plugins and accounts, the
 * transport seam's provider transports, mailboxes and the inbound pipeline.
 *
 * Gauzy is production: `apps/api/src/plugins.ts` lists this plugin only when both `GAUZY_INBOX_ENABLED` and
 * `GAUZY_INBOX_EMAIL_ENABLED` are exactly `true` (after `InboxPlugin`). Off (the default) it is not loaded at all:
 * no route, no GraphQL field, no table (its migrations are not even registered), no transport — every email goes out
 * over SMTP as before.
 */
@Plugin({
	imports: [InboxEmailModule],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...INBOX_EMAIL_ENTITIES],
	migrations: [...INBOX_EMAIL_MIGRATIONS],
	// The GraphQL twins of the management routes, served only with the plugin (both flags on).
	extensions: {
		schema: inboxEmailSchemaExtensions,
		resolvers: [InboxProviderAccountResolver, InboxMailboxResolver, InboxEmailMessageResolver]
	},
	// Auto-provisioning: every employee the platform creates (the mailbox is created where the organization opted in).
	subscribers: [InboxEmployeeCreatedSubscriber],
	configuration: (config: ApplicationPluginConfig) => config
})
export class InboxEmailPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('InboxEmailPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('InboxEmailPlugin is being destroyed...');
	}
}
