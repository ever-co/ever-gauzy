import { Column, JoinColumn, JoinTable, RelationId } from 'typeorm';
import { Property as MikroORMProperty } from '@mikro-orm/core';
import * as chalk from 'chalk';
import { ApplicationPluginConfig, CustomEmbeddedFields, RelationCustomEmbeddedFieldConfig } from '@gauzy/common';
import {
	getColumnType,
	parseMikroOrmColumnOptions,
	resolveDbType
} from '../../../core/decorators/entity/column.helper';
import { MultiORMManyToMany, MultiORMManyToOne } from '../../../core/decorators';
import { applyTypeOrmIndex, applyMikroOrmIndex } from '../../../core/decorators/entity/column-index.decorator';
import { ColumnDataType, ColumnOptions } from '../../../core/decorators/entity/column-options.types';
import { MultiORM, getDBType } from '../../../core/utils';
import { mikroOrmCustomEntityFieldRegistrations, typeOrmCustomEntityFieldRegistrations } from './custom-entity-fields';
import { __FIX_RELATIONAL_CUSTOM_FIELDS__ } from './mikro-orm-base-custom-entity-field';

/**
 * Defines a column with or without a relation ID and optional indexing.
 * Applies only the decorator for the specified ORM type.
 *
 * @param config - The application configuration.
 * @param customField - Configuration for the custom field.
 * @param name - The name of the field.
 * @param instance - The instance of the class where the field is defined.
 * @param ormType - The ORM type ('typeorm' or 'mikro-orm') to apply decorators for.
 */
const defineColumn = (
	config: ApplicationPluginConfig,
	customField: RelationCustomEmbeddedFieldConfig,
	name: string,
	instance: any,
	ormType: MultiORM
) => {
	const { nullable, relationId, index = false } = customField;

	// Get the database type from the connection options
	let dbEngine = getDBType(config.dbConnectionOptions);

	const options: ColumnDataType | ColumnOptions<any> = {
		type: getColumnType(dbEngine, customField.type),
		name,
		nullable: nullable === false ? false : true,
		unique: customField.unique ?? false
	};

	if (ormType === 'typeorm') {
		// Apply TypeORM-specific decorators
		if (relationId) {
			RelationId((it: any) => it.customFields[customField.relation])(instance, name);
		}
		if (index) {
			applyTypeOrmIndex(instance, name, undefined, undefined, {});
		}
		Column(options)(instance, name);
	} else {
		// Apply MikroORM-specific decorators
		if (index) {
			applyMikroOrmIndex(instance, name as never, undefined, undefined, {});
		}

		const type = resolveDbType((options as ColumnOptions<any>).type);
		MikroORMProperty(parseMikroOrmColumnOptions({ type, options: options as ColumnOptions<any> }))(instance, name);
	}
};

/**
 * Registers a custom field for an entity based on the custom field configuration.
 * Uses MultiORM* decorators for relations (which already have ORM-type guards)
 * but ORM-specific decorators for columns and indexes.
 *
 * @param config - The application configuration.
 * @param customField - The custom field configuration.
 * @param name - The name of the custom field.
 * @param instance - The entity instance to which the field is being registered.
 * @param ormType - The ORM type ('typeorm' or 'mikro-orm') to apply decorators for.
 */
export const registerFields = async (
	config: ApplicationPluginConfig,
	customField: RelationCustomEmbeddedFieldConfig,
	name: string,
	instance: any,
	ormType: MultiORM
): Promise<void> => {
	if (customField.type === 'relation') {
		switch (customField.relationType) {
			case 'many-to-many': {
				const options = {
					...(customField.pivotTable && { pivotTable: customField.pivotTable }),
					...(customField.joinColumn && { joinColumn: customField.joinColumn }),
					...(customField.inverseJoinColumn && { inverseJoinColumn: customField.inverseJoinColumn })
				};
				// MultiORMManyToMany already has ORM-type guards via getORMType()
				MultiORMManyToMany(() => customField.entity, customField.inverseSide, options)(instance, name);
				JoinTable({ name: customField.pivotTable })(instance, name);
				break;
			}
			case 'many-to-one': {
				const options = {
					nullable: customField.nullable === false ? false : true,
					unique: customField.unique ?? false,
					...(customField.onDelete && { onDelete: customField.onDelete })
				};
				// MultiORMManyToOne already has ORM-type guards via getORMType()
				MultiORMManyToOne(() => customField.entity, customField.inverseSide, options)(instance, name);
				JoinColumn()(instance, name);
				break;
			}
			default:
				throw new Error(`Unsupported relation type: ${customField.relationType}`);
		}
	} else {
		defineColumn(config, customField, name, instance, ormType);
	}
};

/**
 * Registers custom fields for a specific entity in the provided application configuration.
 * Uses ORM-specific decorators based on the ormType parameter.
 *
 * @param config - The application configuration.
 * @param entityName - The name of the entity for which custom fields are registered.
 * @param ctor - The constructor function for the custom fields.
 * @param ormType - The ORM type ('typeorm' or 'mikro-orm') to apply decorators for.
 */
async function registerCustomFieldsForEntity<T>(
	config: ApplicationPluginConfig,
	entityName: keyof CustomEmbeddedFields,
	ctor: { new (): T },
	ormType: MultiORM
): Promise<void> {
	// Get the list of custom fields for the specified entity, defaulting to an empty array if none are found
	const customFields = config.customFields?.[entityName] ?? [];

	// Create a single instance of the constructor
	const instance = new ctor();

	// Register each custom field
	await Promise.all(
		customFields.map(async (customField) => {
			const { name } = customField; // Destructure to get property path
			await registerFields(config, customField, name, instance, ormType); // Register the custom column
		})
	);

	/**
	 * If there are only relations are defined for an Entity for customFields, then TypeORM not saving relations for entity ("Cannot set properties of undefined (<fieldName>)").
	 * So we have to add a "fake" column to the customFields embedded type to prevent this error from occurring.
	 */
	if (customFields.length > 0) {
		if (ormType === 'typeorm') {
			// Apply TypeORM Column directly
			Column({
				type: 'boolean',
				nullable: true,
				select: false // This ensures the property is not selected by default
			})(instance, __FIX_RELATIONAL_CUSTOM_FIELDS__);
		} else {
			// Apply MikroORM Property directly
			MikroORMProperty({
				type: 'boolean',
				nullable: true,
				hidden: true
			})(instance, __FIX_RELATIONAL_CUSTOM_FIELDS__);
		}
	}
}

/**
 * Registers custom fields for TypeORM entities based on a given configuration.
 *
 * @param config The configuration for the application plugins.
 * @throws Error if there's a failure during the registration process.
 */
export async function registerTypeOrmCustomFields(config: ApplicationPluginConfig): Promise<void> {
	console.time(chalk.yellow('✔ Registering Custom Entity Fields for TypeORM'));

	try {
		// Loop through the custom field registrations and register each for the corresponding entity
		for (const registration of typeOrmCustomEntityFieldRegistrations) {
			await registerCustomFieldsForEntity(config, registration.entityName, registration.customFields, 'typeorm');
		}
	} catch (error) {
		console.error('Error registering custom entity fields:', error);
		throw new Error('Failed to register custom entity fields');
	}

	console.timeEnd(chalk.yellow('✔ Registering Custom Entity Fields for TypeORM'));
}

/**
 * Registers custom fields for MikroORM entities based on a given configuration.
 *
 * @param config The configuration for the application plugins.
 * @throws Error if there's a failure during the registration process.
 */
export async function registerMikroOrmCustomFields(config: ApplicationPluginConfig): Promise<void> {
	console.time(chalk.yellow('✔ Registering Custom Entity Fields for MikroORM'));

	try {
		// Loop through the custom field registrations for MikroORM
		for (const registration of mikroOrmCustomEntityFieldRegistrations) {
			await registerCustomFieldsForEntity(
				config,
				registration.entityName,
				registration.customFields,
				'mikro-orm'
			);
		}
	} catch (error) {
		console.error('Error registering custom entity fields for MikroORM:', error);
		throw new Error('Failed to register custom entity fields for MikroORM');
	}

	console.timeEnd(chalk.yellow('✔ Registering Custom Entity Fields for MikroORM'));
}
