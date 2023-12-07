import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from 'typeorm';
import { IntegrationSetting } from './integration-setting.entity';
import { keysToWrapSecrets, sensitiveSecretKeys } from './integration-setting.utils';

@EventSubscriber()
export class IntegrationSettingSubscriber implements EntitySubscriberInterface<IntegrationSetting> {
    /**
     * Indicates that this subscriber only listen to IntegrationSetting events.
     */
    listenTo() {
        return IntegrationSetting;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    async afterLoad(
        entity: IntegrationSetting | Partial<IntegrationSetting>,
        event?: LoadEvent<IntegrationSetting>
    ): Promise<any | void> {

        // Extract sensitive information from the entity
        const { settingsName, settingsValue } = entity;

        // Specify the percentage of the string to be replaced with the character
        const percentage = 25;

        // Create an object containing the sensitive data
        const secrets: Record<string, string> = {
            [settingsName]: settingsValue,
        };

        // Apply the wrapping function only to the sensitive keys
        const wrapped = keysToWrapSecrets(sensitiveSecretKeys, secrets, percentage);

        entity.wrapSecretKey = settingsName;
        entity.wrapSecretvalue = wrapped[settingsName];
    }
}
