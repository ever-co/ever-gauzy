/**
 * Configuration for a custom embedded field within a relation.
 */
export type RelationCustomEmbeddedFieldConfig<T = any> = {
    /** Name of the custom field. */
    propertyPath: string;
    /** Target entity for the relation. */
    entity: T;
    /** Type of the relation field. */
    type: string;
    /** Name of the relation. */
    relationType: string;
    /** Indicates if the relation should be eagerly loaded. */
    eager?: boolean;
    /** Indicates if the relation is nullable. */
    nullable?: boolean;
    /** Indicates if the relation should have a unique constraint. */
    unique?: boolean;
    /** Specifies the inverse side of the relation. */
    inverseSide?: string | ((object: T) => any);
};

/**
 * Alias for RelationCustomEmbeddedFieldConfig.
 */
export type CustomEmbeddedFieldConfig = RelationCustomEmbeddedFieldConfig;

/**
 * Defines custom embedded fields for different entities.
 */
export interface CustomEmbeddedFields {
    /** Custom fields for the Tag entity. */
    Tag?: CustomEmbeddedFieldConfig[];
    /** Custom fields for the Employee entity. */
    Employee?: CustomEmbeddedFieldConfig[];
}

/**
 * Interface for entities that may have custom embedded fields.
 */
export interface HasCustomFields {
    /** Custom fields for different entities. */
    customFields?: CustomEmbeddedFields;
}
