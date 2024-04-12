import { ColumnOptions, JoinTable, ManyToMany } from 'typeorm';
import { ApplicationPluginConfig, CustomFields } from '@gauzy/common';
import { CustomTagFields } from './custom-entity-fields';

/**
 * Registers custom fields for a specific entity in the provided application configuration.
 * @param config The application configuration.
 * @param entityName The name of the entity for which custom fields are registered.
 * @param ctor The constructor function for the custom fields.
 */
function registerCustomFieldsForEntity(
    config: ApplicationPluginConfig,
    entityName: keyof CustomFields,
    ctor: { new(): any }
) {
    // Check if custom fields exist for the specified entity in the application configuration
    const customFields = config.customFields?.[entityName];

    if (customFields) {
        for (const customField of customFields) {
            const { name, nullable } = customField;
            const instance = new ctor();

            const registerColumn = () => {
                if (customField.type === 'relation') {
                    if (customField.relation === 'many-to-many') {
                        console.log(customField);
                        ManyToMany(() => customField.entity, customField.inverseSide)(instance, name);
                        JoinTable()(instance, name);
                    }
                    // Add other relation decorators (e.g., ManyToOne, OneToOne) here
                } else {
                    const options: ColumnOptions = {
                        name,
                        nullable: nullable === false ? false : true,
                        unique: customField.unique ?? false,
                    };
                    console.log(options);
                }
            };

            registerColumn();
        }
    }
}

/**
 * Registers custom entity fields for the provided application configuration.
 * @param config The application configuration.
 */
export async function registerCustomEntityFields(config: ApplicationPluginConfig) {
    registerCustomFieldsForEntity(config, 'Tag', CustomTagFields);
}
