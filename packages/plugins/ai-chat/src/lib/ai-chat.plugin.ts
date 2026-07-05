import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { AiChatModule } from './ai-chat.module';
import { AiProviderCredential } from './credentials/ai-provider-credential.entity';

/**
 * AiChatPlugin
 *
 * Backend engine for the embedded AI agent chat:
 * - `POST /api/ai-chat` — streaming chat endpoint (Vercel AI SDK UI message stream)
 * - `GET  /api/ai-chat/config` — provider/model configuration for the current tenant
 * - `/api/ai-chat/credentials` — per-tenant BYOK provider credentials (encrypted at rest)
 *
 * AI providers are contributed by separate plugins
 * (`@gauzy/plugin-ai-provider-anthropic`, `-openai`, `-openrouter`,
 * `-vercel-gateway`, `-gauzy-ai`) via the {@link AiProviderRegistry}.
 */
@Plugin({
	imports: [AiChatModule],
	entities: [AiProviderCredential]
})
export class AiChatPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private logEnabled = true;

	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${AiChatPlugin.name} is being bootstrapped...`));
		}
	}

	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${AiChatPlugin.name} is being destroyed...`));
		}
	}
}
