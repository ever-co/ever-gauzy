import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { EmailProviderPostmarkModule } from './postmark.module';

/**
 * Postmark as an Inbox email provider (`@gauzy/plugin-email-provider-postmark`, plan 04 §5.2, G-P4-7), a copy of the
 * Resend reference plugin.
 *
 * `apps/api/src/plugins.ts` lists it only when `EMAIL_PROVIDER_POSTMARK_ENABLED` is exactly `true`, and only after the
 * Inbox email plugin; off (the default) it is not loaded at all. It owns no table and no migration.
 */
@Plugin({
	imports: [EmailProviderPostmarkModule],
	entities: [],
	configuration: (config: ApplicationPluginConfig) => config
})
export class EmailProviderPostmarkPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('EmailProviderPostmarkPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('EmailProviderPostmarkPlugin is being destroyed...');
	}
}
