import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { EmailProviderResendModule } from './resend.module';

/**
 * Resend as an Inbox email provider (`@gauzy/plugin-email-provider-resend`, plan 04 §5.2, G-P4-4): the reference
 * provider plugin the others copy.
 *
 * `apps/api/src/plugins.ts` lists it only when `EMAIL_PROVIDER_RESEND_ENABLED` is exactly `true`, and only after the
 * Inbox email plugin; off (the default) it is not loaded at all. It owns no table and no migration.
 */
@Plugin({
	imports: [EmailProviderResendModule],
	entities: [],
	configuration: (config: ApplicationPluginConfig) => config
})
export class EmailProviderResendPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('EmailProviderResendPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('EmailProviderResendPlugin is being destroyed...');
	}
}
