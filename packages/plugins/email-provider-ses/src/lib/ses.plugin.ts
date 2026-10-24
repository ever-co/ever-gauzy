import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { EmailProviderSesModule } from './ses.module';

/**
 * Amazon SES as an Inbox email provider (`@gauzy/plugin-email-provider-ses`, plan 04 §5.2, G-P4-7), a copy of the
 * Resend reference plugin.
 *
 * `apps/api/src/plugins.ts` lists it only when `EMAIL_PROVIDER_SES_ENABLED` is exactly `true`, and only after the
 * Inbox email plugin; off (the default) it is not loaded at all. It owns no table and no migration.
 */
@Plugin({
	imports: [EmailProviderSesModule],
	entities: [],
	configuration: (config: ApplicationPluginConfig) => config
})
export class EmailProviderSesPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('EmailProviderSesPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('EmailProviderSesPlugin is being destroyed...');
	}
}
