import { Injectable, Logger } from '@nestjs/common';
import { IEmailProviderDescriptor } from '@gauzy/contracts';
import { IEmailProviderPlugin, IEmailProviderRegistry } from './email-provider.types';

/** A provider id: lower-case letters, digits and dashes, at most 32 characters (it is part of the webhook URL). */
export const EMAIL_PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * The email provider plugins this process has (plan 04 §5.2). Each registers at bootstrap through the
 * `INBOX_EMAIL_PROVIDER_REGISTRY` token; the built-in generic signed webhook registers itself.
 *
 * One plugin per id: a second, different plugin for a taken id is refused (both would verify the same webhooks).
 * Registering the same plugin again is a no-op.
 */
@Injectable()
export class EmailProviderRegistry implements IEmailProviderRegistry {
	private readonly logger = new Logger(EmailProviderRegistry.name);
	private readonly providers = new Map<string, IEmailProviderPlugin>();

	register(provider: IEmailProviderPlugin): void {
		const id = typeof provider?.id === 'string' ? provider.id : '';
		if (!EMAIL_PROVIDER_ID_PATTERN.test(id)) {
			throw new Error('An email provider needs an id of lower-case letters, digits and dashes.');
		}
		if (!provider.displayName || !provider.capabilities || provider.configSchema?.type !== 'object') {
			throw new Error(`The email provider ${id} needs a display name, capabilities and a config schema.`);
		}
		if (provider.capabilities.inbound && !provider.inbound) {
			throw new Error(`The email provider ${id} says it receives mail but has no inbound handler.`);
		}
		if (provider.capabilities.outbound && typeof provider.createTransport !== 'function') {
			throw new Error(`The email provider ${id} says it sends mail but has no transport.`);
		}
		const current = this.providers.get(id);
		if (current && current !== provider) {
			throw new Error(`An email provider is already registered as ${id}.`);
		}
		this.providers.set(id, provider);
		this.logger.log(`Email provider registered: ${id}`);
	}

	unregister(id: string): void {
		this.providers.delete(id);
	}

	get(id: string): IEmailProviderPlugin | undefined {
		return this.providers.get(id);
	}

	list(): IEmailProviderPlugin[] {
		return [...this.providers.values()];
	}

	/** What `GET /api/inbox/providers` answers: each provider's id, name, capabilities and form. */
	describe(): IEmailProviderDescriptor[] {
		return this.list()
			.map((provider) => ({
				id: provider.id,
				displayName: provider.displayName,
				...(provider.description ? { description: provider.description } : {}),
				capabilities: { ...provider.capabilities },
				configSchema: provider.configSchema
			}))
			.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}
}
