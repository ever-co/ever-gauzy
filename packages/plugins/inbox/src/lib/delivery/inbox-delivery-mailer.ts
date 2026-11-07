import { Inject, Injectable } from '@nestjs/common';
import { EmailTemplateEnum, ID } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { EmailSendService } from '@gauzy/core';
import { inboxItemLinkOf, inboxLinkOf, notificationSettingsLinkOf } from './inbox-delivery-rules';

/** Who an email goes to, and where it is sent for. */
export interface IInboxDeliveryRecipient {
	tenantId: ID;
	organizationId?: ID | null;
	email: string;
	name: string;
	/** The template's language. */
	locale?: string | null;
}

/** One entry as an email shows it. */
export interface IInboxDeliveryLine {
	itemId: ID;
	title: string;
	body: string;
	kindLabel: string;
}

/**
 * Sends the delivery lane's emails through the platform's templates (`inbox-notification`, `inbox-digest`) and
 * transports (`EmailSendService.getEmailInstance`: a provider's, else the organization's SMTP, else the tenant's,
 * else `MAIL_*`), in the recipient's language. An email names the entry and links to it in the Inbox; it carries
 * only what the entry shows its recipient.
 */
@Injectable()
export class InboxDeliveryMailer {
	constructor(@Inject(EmailSendService) private readonly sender: EmailSendService) {}

	/** The client the links point into. */
	host(): string {
		return String(env.clientBaseUrl || '').replace(/\/+$/, '');
	}

	async sendNotification(recipient: IInboxDeliveryRecipient, line: IInboxDeliveryLine): Promise<void> {
		const host = this.host();
		const instance = await this.sender.getEmailInstance({ tenantId: recipient.tenantId, organizationId: recipient.organizationId ?? undefined });
		await instance.send({
			template: EmailTemplateEnum.INBOX_NOTIFICATION,
			message: { to: recipient.email },
			locals: {
				locale: recipient.locale || undefined,
				tenantId: recipient.tenantId,
				organizationId: recipient.organizationId ?? undefined,
				host,
				recipientName: recipient.name,
				title: line.title,
				body: line.body,
				kindLabel: line.kindLabel,
				link: inboxItemLinkOf(host, line.itemId),
				settingsLink: notificationSettingsLinkOf(host)
			}
		});
	}

	async sendDigest(recipient: IInboxDeliveryRecipient, lines: IInboxDeliveryLine[], total: number): Promise<void> {
		const host = this.host();
		const instance = await this.sender.getEmailInstance({ tenantId: recipient.tenantId, organizationId: recipient.organizationId ?? undefined });
		await instance.send({
			template: EmailTemplateEnum.INBOX_DIGEST,
			message: { to: recipient.email },
			locals: {
				locale: recipient.locale || undefined,
				tenantId: recipient.tenantId,
				organizationId: recipient.organizationId ?? undefined,
				host,
				recipientName: recipient.name,
				count: total,
				plural: total !== 1,
				items: lines.map((line) => ({ ...line, link: inboxItemLinkOf(host, line.itemId) })),
				more: Math.max(total - lines.length, 0),
				inboxLink: inboxLinkOf(host),
				settingsLink: notificationSettingsLinkOf(host)
			}
		});
	}
}
