// `@gauzy/core` and the AI plugin drag in the whole entity graph: stand-ins are enough for this handler.
// Every name is usable as a decorator factory; the base entity copies its input as the real one does.
jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		return new.target ? undefined : () => undefined;
	}
	class TenantOrganizationBaseEntity {
		constructor(input?: object) {
			if (input) Object.assign(this, input);
		}
	}
	const target: Record<string, unknown> = {
		TenantOrganizationBaseEntity,
		RequestContext: {
			currentTenantId: () => 'tenant-1',
			hasPermission: () => true,
			currentEmployeeId: () => null,
			currentUser: () => null
		},
		parseFindOptionsRelations: () => ({})
	};
	return new Proxy(target, {
		get: (object, name: string) => (name in object ? object[name] : name === '__esModule' ? true : stub)
	});
});
jest.mock('@gauzy/plugin-integration-ai', () => ({ GauzyAIService: class GauzyAIService {} }));

import { SaveEmployeePresetCommand } from '../save-employee-preset.command';
import { SaveEmployeePresetHandler } from './save-employee-preset.handler';

/**
 * Saving a job preset for an employee copies the preset's criteria as that employee's own rows. The copy
 * kept the preset criterion's id, so a second employee saving the same preset took over the first one's rows.
 */
describe('SaveEmployeePresetHandler', () => {
	const presetCriterion = {
		id: 'preset-criterion-1',
		createdAt: new Date('2026-01-01'),
		updatedAt: new Date('2026-01-02'),
		jobPresetId: 'preset-1',
		keyword: 'angular',
		tenantId: 'tenant-1'
	};

	const saveFor = async (employeeId: string) => {
		const employee = { id: employeeId, customFields: { jobPresets: [] } };
		const criterionRepository = { delete: jest.fn(), save: jest.fn() };
		const handler = new SaveEmployeePresetHandler(
			{ find: jest.fn().mockResolvedValue([{ id: 'preset-1', jobPresetCriterions: [presetCriterion] }]) } as any,
			{ findOne: jest.fn().mockResolvedValue(employee), save: jest.fn() } as any,
			criterionRepository as any,
			{ syncGauzyEmployeeJobSearchCriteria: jest.fn() } as any
		);

		await handler.execute(new SaveEmployeePresetCommand({ employeeId, jobPresetIds: ['preset-1'] } as any));

		return criterionRepository;
	};

	it("saves the employee's own criteria rows: no preset criterion id, the target employee", async () => {
		const first = await saveFor('employee-a');
		const second = await saveFor('employee-b');

		for (const [repository, employeeId] of [
			[first, 'employee-a'],
			[second, 'employee-b']
		] as const) {
			const [saved] = repository.save.mock.calls[0][0];
			expect(saved).not.toHaveProperty('id');
			expect(saved).not.toHaveProperty('createdAt');
			expect(saved).toMatchObject({ jobPresetId: 'preset-1', keyword: 'angular', employeeId });
			expect(repository.delete).toHaveBeenCalledWith({ employeeId, tenantId: 'tenant-1' });
		}
	});
});
