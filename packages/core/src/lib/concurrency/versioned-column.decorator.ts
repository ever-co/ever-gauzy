import { MultiORMColumn } from '../core/decorators/entity';

/**
 * Declares the version column an entity opts into optimistic concurrency with.
 *
 * `version` is a convention rather than a column on `BaseEntity`: adding it there would add a
 * column to every table in the product and change the schema of features that never asked for it.
 * An entity that wants the protection declares it with this decorator, which is the same
 * `@MultiORMColumn` every other column uses, so TypeORM and MikroORM receive the same definition —
 * a plain `@VersionColumn()` would only decorate the TypeORM side, and a deployment running the
 * other ORM would then have a `@Versioned()` route with no column behind it.
 *
 * ```ts
 * @MultiORMEntity('invoice', { mikroOrmRepository: () => MikroOrmInvoiceRepository })
 * export class Invoice extends TenantOrganizationBaseEntity {
 * 	@VersionedColumn()
 * 	version: number;
 * }
 * ```
 *
 * The column starts at 1 and is incremented by the write that succeeds, through
 * `commitVersionedUpdate` — never by the entity itself, because an increment applied in application
 * code after a read is exactly the read-then-write window the conditional update closes.
 */
export function VersionedColumn(): PropertyDecorator {
	return MultiORMColumn({ type: 'int', default: 1 });
}
