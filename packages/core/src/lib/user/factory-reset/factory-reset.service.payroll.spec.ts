import 'reflect-metadata';
import { In } from 'typeorm';
import { withStubTypeOrmRepositories } from '../../core/testing/registered-repositories/registered-repositories.fixtures';
import { FactoryResetService } from './factory-reset.service';

/**
 * #10184 item 3: a factory reset deletes the reset organizations' rows table by table from a hand-written list,
 * and `payroll_run` / `payroll_item` were not on it. A reset therefore kept the organization's payroll, with every
 * line's `employeeId` set to null by the employees the same reset deleted.
 */
describe('FactoryResetService — payroll', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATIONS = ['organization-1', 'organization-2'];

	/** The service with every repository it lists answered by a stub that records what it is asked to delete. */
	const resetService = () => {
		const deleted: { entityName: string; conditions: unknown }[] = [];
		const service = withStubTypeOrmRepositories(
			Object.create(FactoryResetService.prototype) as FactoryResetService,
			(_entity, entityName) => ({
				metadata: {
					tableName: entityName,
					ownColumns: [{ propertyName: 'tenantId' }, { propertyName: 'organizationId' }]
				},
				delete: jest.fn(async (conditions: unknown) => {
					deleted.push({ entityName, conditions });
					return { affected: 0, raw: [] };
				})
			})
		);
		(service as any).registerCoreRepositories();
		return { service, deleted };
	};

	it('deletes the payroll lines and runs of the organizations being reset, lines first', async () => {
		const { service, deleted } = resetService();

		await service.deleteSpecificTables({ tenantId: TENANT, organizationIds: ORGANIZATIONS });

		const scope = { tenantId: TENANT, organizationId: In(ORGANIZATIONS) };
		expect(deleted.filter(({ entityName }) => entityName.startsWith('Payroll'))).toEqual([
			{ entityName: 'PayrollItem', conditions: scope },
			{ entityName: 'PayrollRun', conditions: scope }
		]);
	});

	it('removes payroll before the employees its lines are paid to', async () => {
		const { service, deleted } = resetService();

		await service.deleteSpecificTables({ tenantId: TENANT, organizationIds: ORGANIZATIONS });

		const order = deleted.map(({ entityName }) => entityName);
		// Deleting the employees first would null every line's `employeeId` (ON DELETE SET NULL) only for the line
		// to be deleted a moment later.
		expect(order.indexOf('Employee')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('PayrollItem')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('PayrollItem')).toBeLessThan(order.indexOf('Employee'));
	});
});
