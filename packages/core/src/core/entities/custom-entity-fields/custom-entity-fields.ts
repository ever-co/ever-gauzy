import { CustomEmbeddedFields } from "@gauzy/common";
import { MikroOrmEmployeeEntityCustomField, TypeOrmEmployeeEntityCustomField } from "./employee";
import { MikroOrmTagEntityCustomField, TypeOrmTagEntityCustomField } from "./tag";

/**
 * Defines the structure for entity field registration configuration.
 */
export type EntityFieldRegistrationConfig = {
    entityName: keyof CustomEmbeddedFields; // Entity name from CustomEmbeddedFields
    customFields: any; // Custom fields associated with the entity
};

/**
 * Registrations for TypeORM custom entity fields.
 *
 * This array contains configurations for custom fields in TypeORM entities.
 * Each entry specifies the name of the entity and the associated custom fields.
 */
export const typeOrmCustomEntityFieldRegistrations: EntityFieldRegistrationConfig[] = [
    { entityName: 'Employee', customFields: TypeOrmEmployeeEntityCustomField },
    { entityName: 'Tag', customFields: TypeOrmTagEntityCustomField },
];

/**
 * Registrations for MikroORM custom entity fields.
 *
 * This array contains the configurations for custom fields in MikroORM entities.
 * Each entry specifies the entity name and the corresponding custom fields.
 */
export const mikroOrmCustomEntityFieldRegistrations: EntityFieldRegistrationConfig[] = [
    { entityName: 'Employee', customFields: MikroOrmEmployeeEntityCustomField },
    { entityName: 'Tag', customFields: MikroOrmTagEntityCustomField },
];
