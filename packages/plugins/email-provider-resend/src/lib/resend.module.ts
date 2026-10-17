import { Module } from '@nestjs/common';
import { ResendProvider } from './resend.provider';

/**
 * The Resend email provider: one provider that registers itself with the Inbox email provider registry (the
 * `INBOX_EMAIL_PROVIDER_REGISTRY` token, present where `GAUZY_INBOX_EMAIL_ENABLED=true`). No route, no table of its
 * own: its accounts are Inbox provider accounts, its webhook is the Inbox's `/api/inbox/inbound/resend/:accountId`.
 */
@Module({
	providers: [ResendProvider],
	exports: [ResendProvider]
})
export class EmailProviderResendModule {}
