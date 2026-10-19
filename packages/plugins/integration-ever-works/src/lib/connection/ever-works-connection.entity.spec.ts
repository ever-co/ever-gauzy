/**
 * #11096 review: the connection's organization relation is `ON DELETE SET NULL` in the entity too (migration
 * 1791000003100 sets it on the foreign key), so a schema made with `DB_SYNCHRONIZE=true` keeps the connection when its
 * organization is deleted, as a migrated one does.
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { MetadataUtils } from 'typeorm/metadata-builder/MetadataUtils';
import { EverWorksConnection } from './ever-works-connection.entity';

describe('EverWorksConnection organization relation', () => {
	it('is nullable and SET NULL on delete, overriding the base entity CASCADE', () => {
		const tree = MetadataUtils.getInheritanceTree(EverWorksConnection);
		const relation = getMetadataArgsStorage()
			.filterRelations(tree)
			.find((candidate) => candidate.propertyName === 'organization');
		expect(relation?.target).toBe(EverWorksConnection);
		expect(relation?.options).toMatchObject({ nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' });
	});
});
