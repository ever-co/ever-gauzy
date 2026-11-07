// Must stay first: loads the entity graph before anything else pulls an entity.
import 'reflect-metadata';
import '../../core/entities/internal';

import { getMetadataArgsStorage } from 'typeorm';
import { coreEntities } from '../../core/entities';
import { getExportRedactedProperties, redactForExport } from '../../export-import/export-redact.decorator';
import { isExportSkipped } from '../../export-import/skip-export.decorator';
import { UserApiToken } from './user-api-token.entity';

/**
 * A credential is not data a tenant authored: it stays out of every export and import, its digest stays out of every
 * archive and analytics event (both read these marks), and it goes with its owner.
 */
describe('UserApiToken', () => {
	it('is registered with the ORMs', () => {
		expect(coreEntities).toContain(UserApiToken);
	});

	it('is never exported, so an import can never recreate a working token', () => {
		expect(isExportSkipped(UserApiToken)).toBe(true);
	});

	it('marks only the digest, the one secret on the row', () => {
		const marks = getExportRedactedProperties(UserApiToken);

		expect([...marks.keys()]).toEqual(['tokenHash']);
		expect(marks.get('tokenHash')).toEqual({ blank: true });
	});

	it('writes no digest wherever a row is redacted', () => {
		const tokenHash = 'c'.repeat(64);
		const row = Object.assign(new UserApiToken(), { name: 'Agent', prefix: 'gzp_abcd1234', tokenHash });

		const redacted = redactForExport(UserApiToken, row);

		expect(redacted.tokenHash).toBe('');
		expect(JSON.stringify(redacted)).not.toContain(tokenHash);
		expect(redacted.name).toBe('Agent');
	});

	it('goes with its user, which is what deleting an account relies on', () => {
		const relation = getMetadataArgsStorage().relations.find(
			(entry) => entry.target === UserApiToken && entry.propertyName === 'user'
		);

		expect(relation?.options).toMatchObject({ onDelete: 'CASCADE', nullable: false });
	});
});
