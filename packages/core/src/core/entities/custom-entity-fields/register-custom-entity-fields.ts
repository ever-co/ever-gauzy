import { JoinColumn } from 'typeorm';
import { ApplicationPluginConfig, CustomFields, RelationCustomFieldConfig } from '@gauzy/common';
import { MultiORMColumn, MultiORMManyToMany, MultiORMManyToOne } from '../../../core/decorators';
import { ColumnDataType, ColumnOptions } from '../../../core/decorators/entity/column-options.types';
import { CustomEmployeeFields, CustomTagFields } from './custom-entity-fields';

/**
 * Registers a custom column or relation for the entity based on the provided custom field configuration.
 *
 * @param customField The custom field configuration.
 * @param name The name of the custom column or relation.
 * @param instance The instance of the entity class.
 */
export const registerColumn = async (
    customField: RelationCustomFieldConfig,
    name: string,
    instance: any
): Promise<void> => {
    if (customField.type === 'relation') {
        if (customField.relation === 'many-to-many') {
            // Use MultiORMManyToMany decorator to register Many-to-Many relation
            MultiORMManyToMany(() => customField.entity, customField.inverseSide)(instance, name);
        }
        if (customField.relation === 'many-to-one') {
            // Use MultiORMManyToOne decorator to register Many-to-One relation
            MultiORMManyToOne(() => customField.entity, customField.inverseSide)(instance, name);
            JoinColumn()(instance, name);
        }
    } else {
        const { nullable, unique } = customField;
        const options: ColumnDataType | ColumnOptions<any> = {
            name,
            nullable: nullable === false ? false : true,
            unique: unique ?? false,
        };
        MultiORMColumn(options)(instance, name);
        // Logic to handle custom column registration
    }
};

/**
 * Registers custom fields for a specific entity in the provided application configuration.
 *
 * @param config The application configuration.
 * @param entityName The name of the entity for which custom fields are registered.
 * @param ctor The constructor function for the custom fields.
 */
function registerCustomFieldsForEntity<T = any>(
    config: ApplicationPluginConfig,
    entityName: keyof CustomFields,
    ctor: { new(): any }
) {
    // Check if custom fields exist for the specified entity in the application configuration
    const customFields = config.customFields?.[entityName];
    if (customFields) {
        for (const customField of customFields) {
            const { name } = customField;
            const instance = new ctor();

            registerColumn(customField, name, instance);
        }
    }
}

/**
 * Registers custom entity fields for the provided application configuration.
 * @param config The application configuration.
 */
export async function registerCustomEntityFields(config: ApplicationPluginConfig) {
    registerCustomFieldsForEntity(config, 'Tag', CustomTagFields);
    registerCustomFieldsForEntity(config, 'Employee', CustomEmployeeFields);
}
