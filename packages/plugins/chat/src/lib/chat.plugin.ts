import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CHAT_MIGRATIONS } from './database/chat-migrations';
import { ChatResolver } from './graphql/chat.resolver';
import { chatSchemaExtensions } from './graphql/chat.schema';
import { CHAT_ENTITIES, ChatModule } from './chat.module';

export { CHAT_MIGRATIONS };

/**
 * Chat between employees (`@gauzy/plugin-chat`).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` only when `GAUZY_CHAT_ENABLED` is exactly
 * `true` (`isChatEnabled`), and its routes answer only for tenants whose `FEATURE_CHAT` toggle is on. Off (the
 * default) it is not loaded at all: no route, no table (its migrations are not even registered), no role grant.
 */
@Plugin({
	imports: [ChatModule],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...CHAT_ENTITIES],
	migrations: [...CHAT_MIGRATIONS],
	// The GraphQL twins of the read routes (the chat spec, T17), served only with the plugin.
	extensions: {
		schema: chatSchemaExtensions,
		resolvers: [ChatResolver]
	},
	configuration: (config: ApplicationPluginConfig) => config
})
export class ChatPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('ChatPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('ChatPlugin is being destroyed...');
	}
}
