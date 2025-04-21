import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationPluginConfig, CustomEmbeddedFieldConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ZapierModule } from './zapier.module';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';

@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [ZapierModule],
	/**
	 * Entity needed for Zapier integration that extends the existing
	 * IntegrationSetting entity to store webhook subscription data
	 */
	entities: [ZapierWebhookSubscription],
	/**
	 * A callback that receives the main plugin configuration object and allows
	 * custom modifications before returning the final configuration.
	 *
	 * @param {ApplicationPluginConfig} config - The initial plugin configuration object.
	 * @returns {ApplicationPluginConfig} - The modified plugin configuration object.
	 */
	configuration: (config: ApplicationPluginConfig): ApplicationPluginConfig => {
		// Initialize customFields if it doesn't exist
		if (!config.customFields) {
			config.customFields = {};
		}

		// Add custom fields for Zapier webhook subscriptions
		const integrationSettingFields: CustomEmbeddedFieldConfig[] = [
			{
				name: 'webhookSubscriptions',
				type: 'relation',
				relationType: 'one-to-many',
				entity: ZapierWebhookSubscription,
				nullable: true,
				onDelete: 'CASCADE'
			}
		];

		// Add custom fields for Zapier webhook subscription details
		const webhookSubscriptionFields: CustomEmbeddedFieldConfig[] = [
			{
				name: 'targetUrl',
				type: 'string',
				nullable: false,
				index: true
			},
			{
				name: 'event',
				type: 'string',
				nullable: false,
				index: true
			},
			{
				name: 'isActive',
				type: 'boolean',
				nullable: false,
				default: true
			}
		];

		// Update the customFields object properties instead of reassignment
		Object.assign(config.customFields, {
			IntegrationSetting: integrationSettingFields,
			ZapierWebhookSubscription: webhookSubscriptionFields
		});

		return config;
	}
})
export class IntegrationZapierPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private readonly logger = new Logger(IntegrationZapierPlugin.name);

	constructor(private readonly _config: ConfigService) {}

	/**
	 * Lifecycle hook invoked during the plugin's bootstrap phase.
	 * Validates essential Zapier OAuth configurations and logs the API base URL.
	 */
	onPluginBootstrap(): void {
		this.logger.log(`${IntegrationZapierPlugin.name} is being bootstrapped...`);

		const clientId = this._config.get<string>('zapier.clientId');
		const clientSecret = this._config.get<string>('zapier.clientSecret');

		if (!clientId || !clientSecret) {
			this.logger.warn(
				'Zapier OAuth credentials are not fully configured. Please set GAUZY_ZAPIER_CLIENT_ID and GAUZY_ZAPIER_CLIENT_SECRET.'
			);
		} else {
			this.logger.log('Zapier OAuth credentials are configured successfully.');
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		this.logger.log(`${IntegrationZapierPlugin.name} is being destroyed...`);
	}
}
