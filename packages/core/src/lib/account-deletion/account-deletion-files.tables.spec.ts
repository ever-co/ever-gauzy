import '../core/entities/internal';
import { getMetadataArgsStorage } from 'typeorm';
import { ADDRESSED_ROW_TABLES } from './account-deletion-files';

/**
 * The account deletion sweeps tables by name, and a sweep skips a table the database lacks: a wrong name is a silent
 * no-op (the first version named `email_history`, while `EmailHistory` is stored in `email_sent`). Every name must be
 * the table of an entity that has the `tenantId` and `email` columns the sweep filters on.
 */
describe('ADDRESSED_ROW_TABLES', () => {
	const storage = getMetadataArgsStorage();

	it.each(ADDRESSED_ROW_TABLES.map((table) => [table]))('%s is an entity table with tenantId and email', (table) => {
		const entity = storage.tables.find((candidate) => candidate.name === table);
		expect(entity).toBeDefined();

		const inherited = (target: Function): Function[] =>
			target && target !== Function.prototype ? [target, ...inherited(Object.getPrototypeOf(target))] : [];
		const columns = storage.columns
			.filter((column) => inherited(entity.target as Function).includes(column.target as Function))
			.map((column) => column.propertyName);
		expect(columns).toEqual(expect.arrayContaining(['tenantId', 'email']));
	});
});
