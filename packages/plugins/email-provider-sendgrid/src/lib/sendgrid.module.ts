import { Module } from '@nestjs/common';
import { SendGridProvider } from './sendgrid.provider';

/**
 * The SendGrid email provider: one provider that registers itself with the Inbox email provider registry (the
 * `INBOX_EMAIL_PROVIDER_REGISTRY` token, present where `GAUZY_INBOX_EMAIL_ENABLED=true`). No route, no table of its
 * own: its accounts are Inbox provider accounts, its webhook is the Inbox's `/api/inbox/inbound/sendgrid/:accountId`.
 */
@Module({
	providers: [SendGridProvider],
	exports: [SendGridProvider]
})
export class EmailProviderSendGridModule {}
