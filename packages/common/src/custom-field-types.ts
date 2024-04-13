/**
 * Configuration for a custom relation field.
 * @template T - Type of the target entity.
 */
export type RelationCustomFieldConfig<T = any> = {
    /** Name of the custom field. */
    name: string;
    /** Target entity for the relation. */
    entity: T;
    /** Type of the relation field. */
    type: string;
    /** Name of the relation. */
    relation: string;
    /** Indicates if the relation should be eagerly loaded. */
    eager?: boolean;
    /** Indicates if the relation is nullable. */
    nullable?: boolean;
    /** Indicates if the relation should have unique constraint. */
    unique?: boolean;
    /** Specifies the inverse side of the relation. */
    inverseSide?: string | ((object: T) => any);
};

/**
 * Represents a configuration for a custom field.
 * @template T - Type of the target entity.
 */
export type CustomFieldConfig = RelationCustomFieldConfig;

/**
 * Represents custom fields for different entities.
 * @template T - Type of the target entity.
 */
export interface CustomFields {
    /** Custom fields for the Tag entity. */
    Tag?: CustomFieldConfig[];
    Employee?: CustomFieldConfig[];
}

/**
 * Represents an entity that can have custom fields.
 */
export interface HasCustomFields {
    /** Custom fields for different entities. */
    customFields?: CustomFields;
}
