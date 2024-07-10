import { RelationOptions as TypeOrmRelationOptions } from 'typeorm';

export type TypeORMInverseSide<T> = string | ((object: T) => any);

/**
 * Extended options for TypeORM relations with additional customization properties.
 */
export type TypeORMRelationOptions = Omit<TypeOrmRelationOptions, 'cascade'> & {
	/** Whether the relation should be eagerly loaded. Default is false. */
	eager?: boolean;
	/** Cascade options for the relation. */
	cascade?: Array<'insert' | 'update' | 'remove' | 'soft-remove' | 'recover'>;
	/** Whether the relation is nullable. Default is false. */
	nullable?: boolean;
	/** Whether the relation should have a unique constraint. Default is false. */
	unique?: boolean;
	/** Default value for the relation. */
	default?: any;
	/** Whether the relation should be persisted automatically. Default is true. */
	persist?: boolean;
	/** Additional arbitrary options for the relation (such as indices, etc.). */
	[key: string]: any;
};

/**
 * Configuration for a custom embedded field within a relation.
 */
export type RelationCustomEmbeddedFieldConfig<T = any> = TypeORMRelationOptions & {
	/** Name of the custom field. */
	name: string;
	/** Type of the relation field. */
	type: string;
	/** Name of the relation. */
	relationType?: string;
	/** Target entity for the relation. */
	entity?: T;
	/** Intermediate table for Many-to-Many relationships. */
	pivotTable?: string;
	/** Name of the column in the current entity's table. */
	joinColumn?: string;
	/** Name of the column in a Many-to-Many relationship. */
	inverseJoinColumn?: string;
	/** Specifies the inverse side of the relation. */
	inverseSide?: TypeORMInverseSide<T>;
};

/**
 * Alias for RelationCustomEmbeddedFieldConfig.
 */
export type CustomEmbeddedFieldConfig = RelationCustomEmbeddedFieldConfig;

/**
 * Defines custom embedded fields for different entities.
 */
export interface CustomEmbeddedFields {
	/** Custom fields for the Employee entity. */
	Employee?: CustomEmbeddedFieldConfig[];
	/** Custom fields for the Organization entity. */
	Organization?: CustomEmbeddedFieldConfig[];
	/** Custom fields for the OrganizationProject entity. */
	OrganizationProject?: CustomEmbeddedFieldConfig[];
	/** Custom fields for the Tag entity. */
	Tag?: CustomEmbeddedFieldConfig[];
	/** Custom fields for the Tenant entity. */
	Tenant?: CustomEmbeddedFieldConfig[];
	/** Custom fields for the User entity. */
	User?: CustomEmbeddedFieldConfig[];
}
