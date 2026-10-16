import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
	getEmailTransportRegistry,
	IEmailTransportRequest,
	IEmailTransportResolution,
	IEmailTransportResolver
} from '@gauzy/core';
import { InboxProviderAccount } from '../entities/inbox-provider-account.entity';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { InboxProviderAccountService } from '../provider-accounts/inbox-provider-account.service';

/** The resolver's id in the core `EmailTransportRegistry`. */
export const INBOX_EMAIL_TRANSPORT_RESOLVER_ID = 'inbox-provider-accounts';

/**
 * Supplies `@gauzy/core`'s email transport seam (plan 04 §5.5) with the provider accounts' API transports, in the
 * plan's order:
 *
 * 1. the account the sender names (an Inbox reply: the provider account of the mailbox it is sent from);
 * 2. the organization's default outbound account;
 * 3. the tenant's default outbound account.
 *
 * When none applies it answers `null`, and `EmailSendService` takes the SMTP chain (Custom SMTP, then `MAIL_*`)
 * exactly as before. An account of another tenant, a disabled one, or one whose provider does not send, is never
 * used. A transport the provider cannot build is logged on the account and the next step is tried.
 */
@Injectable()
export class InboxEmailTransportResolver implements IEmailTransportResolver, OnModuleInit, OnModuleDestroy {
	readonly id = INBOX_EMAIL_TRANSPORT_RESOLVER_ID;
	private readonly logger = new Logger(InboxEmailTransportResolver.name);

	constructor(
		private readonly accounts: InboxProviderAccountService,
		private readonly providers: EmailProviderRegistry
	) {}

	onModuleInit(): void {
		getEmailTransportRegistry().register(this);
	}

	onModuleDestroy(): void {
		getEmailTransportRegistry().unregister(this.id);
	}

	async resolve(request: IEmailTransportRequest): Promise<IEmailTransportResolution | null> {
		const tenantId = request?.tenantId;
		if (!tenantId) {
			return null;
		}
		if (request.providerAccountId) {
			const named = await this.accounts.findUsable(request.providerAccountId, tenantId);
			const resolution = named ? await this.transportOf(named) : null;
			if (resolution) return resolution;
		}
		const fallback = await this.accounts.defaultOutbound(tenantId, request.organizationId ?? null);
		return fallback ? this.transportOf(fallback) : null;
	}

	/** The account's transport, or `null` when its provider does not send or cannot build one. */
	private async transportOf(account: InboxProviderAccount): Promise<IEmailTransportResolution | null> {
		const provider = this.providers.get(account.providerId);
		if (!provider?.capabilities.outbound || typeof provider.createTransport !== 'function') {
			return null;
		}
		try {
			const context = this.accounts.context(account);
			const transport = provider.createTransport(context);
			if (!transport || typeof transport !== 'object') {
				return null;
			}
			const from = context.config['fromAddress'];
			return {
				transport,
				fromAddress: typeof from === 'string' && from ? from : null,
				source: `${account.providerId}:${account.id}`
			};
		} catch (error) {
			this.logger.warn(`Provider account ${account.id} has no usable transport: ${(error as Error)?.name}`);
			await this.accounts.recordError(account.id as string, error);
			return null;
		}
	}
}
