import { RelationOptions as TypeOrmRelationOptions } from 'typeorm';

export type TypeORMInverseSide<T> = string | ((object: T) => any);
export type TypeORMRelationOptions = Omit<TypeOrmRelationOptions, 'cascade'> & {
    /** Indicates whether the relation should be eagerly loaded. Default is false. */
    eager?: boolean;
    /** Specifies the cascade options for the relation (e.g., ['insert', 'update', 'remove', 'soft-remove', 'recover']). */
    cascade?: Array<'insert' | 'update' | 'remove' | 'soft-remove' | 'recover'>;
    /** Determines whether the relation is nullable. Default is false. */
    nullable?: boolean;
    /** Indicates if the relation should have a unique constraint. Default is false. */
    unique?: boolean;
    /** Specifies the default value for the relation (for primitive types). */
    default?: any;
    /** Specifies if the relation should be persisted automatically. Default is true. */
    persist?: boolean;
    /** Additional arbitrary options for the relation (such as indices, etc.). */
    [key: string]: any;
};

/**
 * Configuration for a custom embedded field within a relation.
 */
export type RelationCustomEmbeddedFieldConfig<T = any> = {
    /** Name of the custom field. */
    propertyPath: string;
    /** Type of the relation field. */
    type: string;
    /** Name of the relation. */
    relationType: string;
    /** Target entity for the relation. */
    entity: T;
    /** A pivot table is an intermediate table that connects two entities in a Many-to-Many relationship. */
    pivotTable?: string;
    /** The name of the column in the current entity's table  */
    joinColumn?: string;
    /** The name of the column in a Many-to-Many relationship */
    inverseJoinColumn?: string;
    /** Specifies the inverse side of the relation. */
    inverseSide?: TypeORMInverseSide<T>;
    /** Options for the relation */
    options?: TypeORMRelationOptions;
};

/**
 * Alias for RelationCustomEmbeddedFieldConfig.
 */
export type CustomEmbeddedFieldConfig = RelationCustomEmbeddedFieldConfig;

/**
 * Defines custom embedded fields for different entities.
 */
export interface CustomEmbeddedFields {
    /** Custom fields for the Tenant entity. */
    Tenant?: CustomEmbeddedFieldConfig[];
    /** Custom fields for the Organization entity. */
    Organization?: CustomEmbeddedFieldConfig[];
    /** Custom fields for the User entity. */
    User?: CustomEmbeddedFieldConfig[];
    /** Custom fields for the Employee entity. */
    Employee?: CustomEmbeddedFieldConfig[];
    /** Custom fields for the Tag entity. */
    Tag?: CustomEmbeddedFieldConfig[];
}
