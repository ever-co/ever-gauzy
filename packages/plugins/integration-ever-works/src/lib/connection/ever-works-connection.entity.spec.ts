/**
 * Review of #11096: the connection's organization relation is `ON DELETE SET NULL` in the entity too (migration
 * 1791000003100 sets it on the foreign key), so a schema built with `DB_SYNCHRONIZE=true` keeps the connection when
 * its organization is deleted, as a migrated one does. Read from the metadata TypeORM builds the table from (the real
 * `@gauzy/core` decorators, no double).
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { MetadataUtils } from 'typeorm/metadata-builder/MetadataUtils';
import { TenantBaseEntity } from '@gauzy/core';
import { EverWorksConnection } from './ever-works-connection.entity';

jest.setTimeout(120_000);

describe('EverWorksConnection metadata', () => {
	const tree = MetadataUtils.getInheritanceTree(EverWorksConnection);
	const storage = getMetadataArgsStorage();
	const relation = (property: string) =>
		storage.filterRelations(tree).find((candidate) => candidate.propertyName === property);

	it('the organization relation is nullable and SET NULL on delete (migration 1791000003100), never CASCADE', () => {
		expect(relation('organization')?.options).toMatchObject({
			nullable: true,
			onUpdate: 'CASCADE',
			onDelete: 'SET NULL'
		});
	});

	it('keeps every column and relation of a tenant- and organization-scoped entity', () => {
		expect(new EverWorksConnection()).toBeInstanceOf(TenantBaseEntity);
		expect(relation('tenant')?.options).toMatchObject({ nullable: true, onDelete: 'CASCADE' });
		const column = storage.filterColumns(tree).find((candidate) => candidate.propertyName === 'organizationId');
		expect(column?.options).toMatchObject({ nullable: true });
		expect(storage.filterRelationIds(tree).map((relationId) => relationId.propertyName)).toEqual(
			expect.arrayContaining(['tenantId', 'organizationId'])
		);
		const indexed = storage
			.filterIndices(tree)
			.flatMap((index) => (Array.isArray(index.columns) ? index.columns : []));
		expect(indexed).toEqual(expect.arrayContaining(['tenantId', 'organizationId']));
	});
});
