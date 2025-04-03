import * as chalk from 'chalk';
import { ApplicationPluginConfig, CustomEmbeddedFieldConfig, CustomEmbeddedFields } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ZapierModule } from './zapier.module';
import { ZapierWebhookSubscriptionRepository } from './repository/zapier-repository.entity';
import { Logger } from '@nestjs/common';

// Extend the CustomEmbeddedFields interface to include our custom entities
interface ZapierCustomFields extends CustomEmbeddedFields {
	IntegrationSetting?: CustomEmbeddedFieldConfig[];
	ZapierWebhookSubscription?: CustomEmbeddedFieldConfig[];
}

@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [ZapierModule],
	/**
	 * Entity needed for Zapier integration that extends the existing
	 * IntegrationSetting entity to store webhook subscription data
	 */
	entities: [ZapierWebhookSubscriptionRepository],
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
				entity: ZapierWebhookSubscriptionRepository,
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
	// We enable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${IntegrationZapierPlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			const logger = new Logger(IntegrationZapierPlugin.name);
			logger.log(`${IntegrationZapierPlugin.name} is being destroyed...`)
		}
	}
}
