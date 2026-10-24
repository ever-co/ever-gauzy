import { Property as MikroOrmProperty } from '@mikro-orm/core';
import { MultiORMEnum, getORMType } from '../core/utils';

/**
 * MikroORM's mapping of an optimistic-lock version, the half `@VersionColumn` does not give: TypeORM's decorator
 * maps the column for TypeORM alone, so without this MikroORM has no `version` property at all — a row it
 * inserts leaves the column out, and nothing it writes moves the version a compare-and-set relies on.
 *
 * Declared beside a TypeORM `@VersionColumn()`, as `Token.version` is mapped (`token.entity.ts`): an ordinary
 * integer that starts at 1, as TypeORM's does, rather than MikroORM's `version: true`. MikroORM leaves a
 * `version: true` property out of the INSERT and reads back the column's default, so a row recreated under its
 * own id at version 5 would come back at 1. `CrudService.update` increments the column in the statement, as
 * TypeORM's update does (see `mikroOrmUpdateRow`), which is what a `{ id, version }` compare-and-set relies on.
 * Applied under `DB_ORM=mikro-orm` only, like every MikroORM property decorator on the platform (see
 * `MultiORMColumn`).
 *
 * ```ts
 * @VersionColumn()
 * @MikroOrmVersionProperty()
 * version?: number;
 * ```
 */
export function MikroOrmVersionProperty(): PropertyDecorator {
	return (target, propertyKey) => {
		if (getORMType() === MultiORMEnum.MikroORM) {
			MikroOrmProperty({
				type: 'integer',
				onCreate: (row: { version?: number }) => row.version ?? 1
			})(target, propertyKey as string);
		}
	};
}
