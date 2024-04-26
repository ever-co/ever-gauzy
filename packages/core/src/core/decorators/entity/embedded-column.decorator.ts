import { Embedded, EmbeddedOptions as MikroOrmColumnEmbeddedOptions } from '@mikro-orm/core';
import { Column, ObjectType } from 'typeorm';
import { ColumnEmbeddedOptions as TypeOrmColumnEmbeddedOptions } from 'typeorm/decorator/options/ColumnEmbeddedOptions';

// Represents combined options for mapping an embeddable column in both TypeORM and Mikro ORM.
type CombineColumnEmbeddedOptions = TypeOrmColumnEmbeddedOptions & MikroOrmColumnEmbeddedOptions;
// Represents a function that can be used to obtain the type of an entity
type TargetEntity<T> = (type?: any) => ObjectType<T>;

/**
 * Represents the options for mapping an embeddable column in Mikro ORM.
 */
interface EmbeddableColumnMikroORMOptions<T> {
    /**
     * Represents the type, function, or target entity for the Mikro ORM column.
     */
    typeFunctionOrTarget: TargetEntity<T>;

    /**
     * (Optional) Additional options for the Mikro ORM and Type ORM column.
     */
    options?: CombineColumnEmbeddedOptions;
}

/**
 * A decorator factory for mapping an embeddable column in Mikro ORM.
 * @param typeFunctionOrTarget The type, function, or target entity for the MikroORM & TypeORM Embedded column.
 * @param options Additional options for the MikroORM & TypeORM column.
 * @returns A property decorator.
 */
export function EmbeddedColumn<T>(
    typeFunctionOrTarget?: (type?: any) => ObjectType<T>,
    options?: CombineColumnEmbeddedOptions
): PropertyDecorator {
    // If options are not provided, initialize an empty object
    if (!options) options = {} as CombineColumnEmbeddedOptions;

    // Return a property decorator function
    return (target: any, propertyKey: string) => {
        // Apply the @Embedded decorator with mapped Mikro ORM options
        Embedded(parseEmbeddableColumnMikroORMOptions({ typeFunctionOrTarget, options }))(target, propertyKey);

        // Apply the @Column decorator from TypeORM
        Column(typeFunctionOrTarget as TargetEntity<T>, options)(target, propertyKey);
    };
}

/**
 * Maps EmbeddableColumnMikroORMOptions to MikroOrmColumnEmbeddedOptions.
 *
 * @param param0 The EmbeddableColumnMikroORMOptions to map.
 * @returns The mapped MikroOrmColumnEmbeddedOptions.
 */
export function parseEmbeddableColumnMikroORMOptions<T>({ typeFunctionOrTarget, options }: EmbeddableColumnMikroORMOptions<T>): MikroOrmColumnEmbeddedOptions {
    // Create a partial MikroOrmColumnEmbeddedOptions object to store the mapped options.
    const mikroOrmColumnEmbeddedOptions: Partial<MikroOrmColumnEmbeddedOptions> = {
        // Map the typeFunctionOrTarget to the 'entity' property.
        entity: typeFunctionOrTarget as string | (() => T | T[]),
        // Assign the 'prefix' option from EmbeddableColumnMikroORMOptions, if provided.
        prefix: options?.prefix
    };

    // Return the mapped MikroOrmColumnEmbeddedOptions.
    return mikroOrmColumnEmbeddedOptions as MikroOrmColumnEmbeddedOptions;
}
