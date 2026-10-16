import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager, EntityMetadata, QueryFailedError } from 'typeorm';
import { ID } from '@gauzy/contracts';

/**
 * Plain id columns of an entity — `{ column: tableName }` — and the table of the row each one names.
 *
 * A plain id column holds another row's id without a relation decorator: often because the table it names belongs
 * to a package installed after the one that declares the column, so neither a relation nor a foreign key can be
 * stated. The table is named by its table name (`'product_variant'`), so the declaring package needs no import of the
 * entity; when no entity of the installation maps that table, the column is not checked.
 */
export type PlainReferenceColumns = Readonly<Record<string, string>>;

/** Compares ids the way the platform's other ownership checks do: case-insensitively, as strings. */
const idKey = (id: ID | number): string => String(id).toLowerCase();

/** Only rows with a single `id` primary key and a `tenantId` column belong to a tenant that can be compared. */
const isTenantScoped = (metadata: EntityMetadata): boolean =>
	metadata.primaryColumns.length === 1 &&
	metadata.primaryColumns[0].propertyName === 'id' &&
	metadata.hasColumnWithPropertyPath('tenantId');

/**
 * Refuses payloads whose PLAIN id columns name a row of another tenant (security audit P0 #6c).
 *
 * The platform's cross-tenant check (`assertGraphNotForeign`, SEC-D-03) follows the relation metadata of a written
 * entity: nested relation objects and the join column of every owner-side relation. A plain id column has no
 * relation, so that check never sees it, and a caller of tenant A could store tenant B's product, location, channel
 * or order line in one. A service whose entity has such columns states them and calls this on its write paths.
 *
 * The rule is the one `assertGraphNotForeign` applies to an owner-side relation, stated for these columns:
 *
 * - an id naming a row of ANOTHER tenant is refused (`403`, as the relation check answers), soft-deleted rows
 *   included, since an id is stored whether or not its row is retired;
 * - a row of NO tenant (an installation-wide row) may be linked;
 * - an id that names no row is stored as before — the column has no foreign key, and the platform's check does
 *   not refuse a dangling id either;
 * - an absent, `null` or empty id is not a reference at all, so an update that does not state a column is not
 *   checked for it;
 * - a reference that is not a string (an unvalidated GraphQL input can carry an object) is refused (`400`), as is
 *   an id the database cannot read as one (Postgres refuses a malformed `uuid` in the lookup).
 *
 * Nothing is checked without a caller tenant (a job, a seeder): there is no tenant to hold them to, which is what the
 * platform's check does too. Every id of one column is read in one query.
 *
 * @param manager The TypeORM manager of the installation; the lookups only read.
 * @param payloads The row or rows, or the change set, about to be written.
 * @param references The payloads' plain id columns and the tables they name.
 * @param tenantId The caller's tenant.
 * @throws BadRequestException when a reference is not an id at all.
 * @throws ForbiddenException when a reference names a row of another tenant.
 */
export async function assertPlainReferencesNotForeign(
	manager: EntityManager,
	payloads: unknown,
	references: PlainReferenceColumns,
	tenantId: ID | null | undefined
): Promise<void> {
	const rows = (Array.isArray(payloads) ? payloads : [payloads]).filter(
		(payload): payload is Record<string, unknown> => !!payload && typeof payload === 'object'
	);

	if (!tenantId || rows.length === 0) {
		return;
	}

	for (const [column, table] of Object.entries(references)) {
		const ids = new Set<string>();

		for (const row of rows) {
			const id = row[column];

			if (id === undefined || id === null || id === '') {
				continue;
			}
			if (typeof id !== 'string') {
				throw new BadRequestException(`Invalid reference in "${column}"`);
			}
			ids.add(id);
		}

		if (ids.size === 0 || !manager.connection.hasMetadata(table)) {
			continue;
		}

		const metadata = manager.connection.getMetadata(table);

		if (!isTenantScoped(metadata)) {
			continue;
		}

		let stored: Array<{ tenantId: ID | null }>;

		try {
			stored = await manager
				.createQueryBuilder(metadata.target, 'reference')
				.withDeleted()
				.select('reference.tenantId', 'tenantId')
				.where('reference.id IN (:...ids)', { ids: [...ids] })
				.getRawMany();
		} catch (error) {
			if (error instanceof QueryFailedError) {
				// The database could not read the id as one; its message would echo the query.
				throw new BadRequestException(`Invalid reference in "${column}"`);
			}
			throw error;
		}

		if (stored.some((row) => row.tenantId != null && idKey(row.tenantId) !== idKey(tenantId))) {
			throw new ForbiddenException('A related record belongs to another tenant');
		}
	}
}
