import { JoinColumn } from 'typeorm';
import { ApplicationPluginConfig, CustomEmbeddedFields, RelationCustomEmbeddedFieldConfig } from '@gauzy/common';
import { MultiORMColumn, MultiORMManyToMany, MultiORMManyToOne } from '../../../core/decorators';
import { ColumnDataType, ColumnOptions } from '../../../core/decorators/entity/column-options.types';
import { CustomEmployeeFields, CustomTagFields } from './custom-entity-fields';

export const __FIX_RELATIONAL_CUSTOM_FIELDS__ = '__fix_relational_custom_fields__';

/**
 * Registers a custom column or relation for the entity based on the provided custom field configuration.
 *
 * @param customField The custom field configuration.
 * @param name The name of the custom column or relation.
 * @param instance The instance of the entity class.
 */
export const registerColumn = async (
    customField: RelationCustomEmbeddedFieldConfig,
    name: string,
    instance: any
): Promise<void> => {
    if (customField.type === 'relation') {
        if (customField.relationType === 'many-to-many') {
            // Use MultiORMManyToMany decorator to register Many-to-Many relation
            MultiORMManyToMany(() => customField.entity, customField.inverseSide)(instance, name);
        }
        if (customField.relationType === 'many-to-one') {
            // Use MultiORMManyToOne decorator to register Many-to-One relation
            MultiORMManyToOne(() => customField.entity, customField.inverseSide)(instance, name);
            JoinColumn()(instance, name);
        }
    } else {
        const { nullable, unique } = customField.options;
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
function registerCustomFieldsForEntity<T>(
    config: ApplicationPluginConfig,
    entityName: keyof CustomEmbeddedFields,
    ctor: { new(): T }
): void {
    const customFields = config.customFields?.[entityName] ?? [];
    const instance = new ctor();

    for (const customField of customFields) {
        const { propertyPath } = customField;
        registerColumn(customField, propertyPath, instance);
    }

    /**
     * If there are only relations are defined for an Entity for customFields, then TypeORM not saving realtions for entity ("Cannot set properties of undefined (<fieldName>)").
     * So we have to add a "fake" column to the customFields embedded type to prevent this error from occurring.
     */
    if (customFields.length > 0) {
        MultiORMColumn({
            type: 'boolean',
            nullable: true
        })(instance, __FIX_RELATIONAL_CUSTOM_FIELDS__);
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
