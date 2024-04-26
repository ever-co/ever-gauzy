import { CustomEmbeddedFields } from "@gauzy/common";
import { CustomTagEntityFields } from "./custom-tag-entity-fields";
import { CustomEmployeeEntityFields } from "./custom-employee-entity-fields";

/**
 * Defines the structure for entity field registration configuration.
 */
type EntityFieldRegistrationConfig = {
    entityName: keyof CustomEmbeddedFields; // Entity name from CustomEmbeddedFields
    customFields: any; // Custom fields associated with the entity
};

/**
 * A list of custom entity field registrations, mapping entity names to their custom field configurations.
 */
export const customEntityFieldRegistrations: EntityFieldRegistrationConfig[] = [
    { entityName: 'Employee', customFields: CustomEmployeeEntityFields },
    { entityName: 'Tag', customFields: CustomTagEntityFields },
];
