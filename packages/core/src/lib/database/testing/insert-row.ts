import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

/**
 * Test helpers for specs that run on a real database built from the entities (excluded from the library build, as
 * every `testing` folder of the package is).
 */

/**
 * A value for a NOT NULL column without a default that a row leaves out.
 *
 * @param type The column type, as TypeORM's metadata gives it.
 */
export function placeholderFor(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/uuid/.test(name)) return '99000000-0000-4000-8000-0000000000ff';
	if (/int|number|numeric|decimal|real|float|double/.test(name)) return 0;
	if (/bool/.test(name)) return false;
	if (/date|time/.test(name)) return new Date('2026-01-01T00:00:00Z');
	if (/json/.test(name)) return {};
	return 'x';
}

/**
 * Inserts a row with the columns given and a placeholder in every other NOT NULL column without a default.
 *
 * @param dataSource An initialized data source.
 * @param entity The entity of the row.
 * @param row The columns that matter to the test.
 */
export async function insertRow(
	dataSource: DataSource,
	entity: EntityTarget<ObjectLiteral>,
	row: Record<string, unknown>
): Promise<void> {
	const metadata = dataSource.getMetadata(entity);
	const values: Record<string, unknown> = { ...row };
	for (const column of metadata.columns) {
		const needsNoValue =
			column.isNullable ||
			column.default !== undefined ||
			column.isGenerated ||
			column.isCreateDate ||
			column.isUpdateDate ||
			column.isVirtual ||
			!!column.relationMetadata;
		if (column.propertyName in values || needsNoValue) continue;
		values[column.propertyName] = placeholderFor(column.type);
	}
	await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
}
