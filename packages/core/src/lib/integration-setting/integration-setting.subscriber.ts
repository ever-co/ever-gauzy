import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { IntegrationSetting } from './integration-setting.entity';
import { keysToWrapSecrets, nonSecretSettingKeys } from './integration-setting.utils';

@EventSubscriber()
export class IntegrationSettingSubscriber extends BaseEntityEventSubscriber<IntegrationSetting> {
	/**
	 * Indicates that this subscriber only listen to IntegrationSetting events.
	 */
	listenTo() {
		return IntegrationSetting;
	}

	/**
	 * Called after an IntegrationSetting entity is loaded from the database. This method handles
	 * sensitive information by partially masking it before presenting to the user.
	 *
	 * @param entity The IntegrationSetting entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the post-load processing is complete.
	 */
	async afterEntityLoad(entity: IntegrationSetting): Promise<void> {
		try {
			// Extract sensitive information from the entity
			const { settingsName, settingsValue } = entity;
			// Specify the percentage of the string to be replaced with the character
			const percentage = 25;

			entity.wrapSecretKey = settingsName;
			entity.wrapSecretValue = settingsValue;

			// Default-deny: mask EVERY settings value unless its name is on the explicit non-secret
			// allowlist. This ensures OAuth access/refresh tokens, client secrets and similar
			// credentials are never returned in cleartext (GHSA-3rqg-gpm9-gx84).
			if (typeof settingsValue === 'string' && !nonSecretSettingKeys.includes(settingsName)) {
				// Create an object containing the sensitive data
				const secrets: Record<string, string> = { [settingsName]: settingsValue };
				// Apply the wrapping function to this setting's value
				const wrapped = keysToWrapSecrets([settingsName], secrets, percentage);
				entity.wrapSecretValue = wrapped[settingsName];
			}
		} catch (error) {
			console.error('IntegrationSettingSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}
}
