import { JoinColumn, JoinTable } from 'typeorm';
import { ApplicationPluginConfig, CustomEmbeddedFields, RelationCustomEmbeddedFieldConfig } from '@gauzy/common';
import { MultiORMColumn, MultiORMManyToMany, MultiORMManyToOne } from '../../../core/decorators';
import { ColumnDataType, ColumnOptions } from '../../../core/decorators/entity/column-options.types';
import { mikroOrmCustomEntityFieldRegistrations, typeOrmCustomEntityFieldRegistrations } from './custom-entity-fields';

const __FIX_RELATIONAL_CUSTOM_FIELDS__ = '__fix_relational_custom_fields__';

/**
 * Registers a custom field for an entity based on the custom field configuration.
 *
 * @param customField - The custom field configuration.
 * @param name - The name of the custom field.
 * @param instance - The entity instance to which the field is being registered.
 */
export const registerFields = async (
    customField: RelationCustomEmbeddedFieldConfig,
    name: string,
    instance: any
): Promise<void> => {
    if (customField.type === 'relation') {
        if (customField.relationType === 'many-to-many') {
            // Register Many-to-Many relation with additional options
            const relationOptions = {
                ...(customField.pivotTable && { pivotTable: customField.pivotTable }),
                ...(customField.joinColumn && { joinColumn: customField.joinColumn }),
                ...(customField.inverseJoinColumn && { inverseJoinColumn: customField.inverseJoinColumn }),
            };
            // Register a Many-to-Many relation
            MultiORMManyToMany(() => customField.entity, customField.inverseSide, relationOptions)(instance, name);
            JoinTable({ name: customField.pivotTable })(instance, name);
        } else if (customField.relationType === 'many-to-one') {
            // Register a Many-to-One relation
            MultiORMManyToOne(() => customField.entity, customField.inverseSide)(instance, name);
            JoinColumn()(instance, name);
        }
    } else {
        // Register a custom column
        const { nullable, unique } = customField.options;
        const options: ColumnDataType | ColumnOptions<any> = {
            name,
            nullable: nullable === false ? false : true,
            unique: unique ?? false,
        };
        MultiORMColumn(options)(instance, name);
    }
};

/**
 * Registers custom fields for a specific entity in the provided application configuration.
 *
 * @param config - The application configuration.
 * @param entityName - The name of the entity for which custom fields are registered.
 * @param ctor - The constructor function for the custom fields.
 */
async function registerCustomFieldsForEntity<T>(
    config: ApplicationPluginConfig,
    entityName: keyof CustomEmbeddedFields,
    ctor: { new(): T }
): Promise<void> {
    // Get the list of custom fields for the specified entity, defaulting to an empty array if none are found
    const customFields = config.customFields?.[entityName] ?? [];

    // Create a single instance of the constructor
    const instance = new ctor();

    // Register each custom field
    await Promise.all(
        customFields.map(async (customField) => {
            const { propertyPath } = customField; // Destructure to get property path
            await registerFields(customField, propertyPath, instance); // Register the custom column
        })
    );

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
 * Registers custom fields for TypeORM entities based on a given configuration.
 *
 * @param config The configuration for the application plugins.
 * @throws Error if there's a failure during the registration process.
 */
export async function registerTypeOrmCustomFields(config: ApplicationPluginConfig): Promise<void> {
    try {
        // Loop through the custom field registrations and register each for the corresponding entity
        for (const registration of typeOrmCustomEntityFieldRegistrations) {
            await registerCustomFieldsForEntity(config, registration.entityName, registration.customFields);
        }
    } catch (error) {
        console.error('Error registering custom entity fields:', error);
        throw new Error('Failed to register custom entity fields');
    }
}

/**
 * Registers custom fields for MikroORM entities based on a given configuration.
 *
 * @param config The configuration for the application plugins.
 * @throws Error if there's a failure during the registration process.
 */
export async function registerMikroOrmCustomFields(config: ApplicationPluginConfig): Promise<void> {
    try {
        // Loop through the custom field registrations for MikroORM
        for (const registration of mikroOrmCustomEntityFieldRegistrations) {
            await registerCustomFieldsForEntity(config, registration.entityName, registration.customFields);
        }
    } catch (error) {
        console.error('Error registering custom entity fields for MikroORM:', error);
        throw new Error('Failed to register custom entity fields for MikroORM');
    }
}
