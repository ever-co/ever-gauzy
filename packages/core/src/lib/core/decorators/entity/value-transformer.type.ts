import { Type } from '@mikro-orm/core';
import { ValueTransformer } from 'typeorm';

/** What TypeORM's `transformer` column option accepts. */
export type ColumnValueTransformer = ValueTransformer | ValueTransformer[];

/**
 * Runs a TypeORM `ValueTransformer` under MikroORM.
 *
 * MikroORM has no `transformer` column option, and `@MultiORMColumn` passed ours straight into
 * `@Property`, where it was ignored: with `DB_ORM=mikro-orm` a money column skipped the rounding and
 * validation in `ColumnNumericTransformerPipe`, and an int-backed enum column (actor type,
 * availability status) was read and written as a raw number. Wrapping the transformer in a MikroORM
 * `Type` makes both ORMs store and hydrate a column the same way.
 */
export class ValueTransformerType extends Type<any, any> {
	constructor(
		private readonly transformer: ColumnValueTransformer,
		private readonly declaredColumnType?: string
	) {
		super();
	}

	/**
	 * @param value - The entity value to store.
	 * @returns The database representation, as TypeORM's transformer produces it.
	 */
	convertToDatabaseValue(value: any): any {
		// Same order as TypeORM's ApplyValueTransformers.transformTo: first transformer first.
		return Array.isArray(this.transformer)
			? this.transformer.reduce((transformed, transformer) => transformer.to(transformed), value)
			: this.transformer.to(value);
	}

	/**
	 * @param value - The raw database value.
	 * @returns The entity representation, as TypeORM's transformer produces it.
	 */
	convertToJSValue(value: any): any {
		// Same order as TypeORM's ApplyValueTransformers.transformFrom: reversed.
		return Array.isArray(this.transformer)
			? this.transformer.reduceRight((transformed, transformer) => transformer.from(transformed), value)
			: this.transformer.from(value);
	}

	/**
	 * Keep the column DDL the entity declared (e.g. `numeric(14,2)`), rather than letting MikroORM
	 * infer it from this wrapper.
	 */
	getColumnType(): string | undefined {
		return this.declaredColumnType;
	}

	/**
	 * The transformer decides the stored shape, so compare the raw values as they come.
	 */
	compareAsType(): string {
		return 'any';
	}
}

/**
 * Builds the exact column DDL for {@link ValueTransformerType} from the declared column options, so
 * the modifiers survive: `numeric` + 14/2 → `numeric(14,2)`, `varchar` + 255 → `varchar(255)`.
 *
 * @param type - The declared column type.
 * @param options - The column options.
 * @returns The column type string, or undefined to let MikroORM infer it.
 */
export function declaredColumnType(
	type: unknown,
	options: { length?: number; precision?: number; scale?: number } = {}
): string | undefined {
	if (typeof type !== 'string') {
		return undefined;
	}
	const { length, precision, scale } = options;

	if (precision != null) {
		return scale != null ? `${type}(${precision},${scale})` : `${type}(${precision})`;
	}

	return length != null ? `${type}(${length})` : type;
}
