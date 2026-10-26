// `@gauzy/core` and the AI plugin drag in the whole entity graph: stand-ins are enough here.
// Every name is usable as a decorator factory; the base entity copies its input as the real one does.
const mockContext = {
	tenantId: 'tenant-1' as string | null,
	hasPermission: true
};

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
			currentTenantId: () => mockContext.tenantId,
			hasPermission: () => mockContext.hasPermission,
			currentEmployeeId: () => 'employee-own',
			currentUser: () => null
		},
		parseFindOptionsRelations: () => ({})
	};
	return new Proxy(target, {
		get: (object, name: string) => (name in object ? object[name] : name === '__esModule' ? true : stub)
	});
});
jest.mock('@gauzy/plugin-integration-ai', () => ({ GauzyAIService: class GauzyAIService {} }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateJobPresetCommand } from './commands/create-job-preset.command';
import { SaveEmployeeCriterionCommand } from './commands/save-employee-criterion.command';
import { SavePresetCriterionCommand } from './commands/save-preset-criterion.command';
import { CreateJobPresetHandler } from './commands/handlers/create-job-preset.handler';
import { SaveEmployeeCriterionHandler } from './commands/handlers/save-employee-criterion.handler';
import { SavePresetCriterionHandler } from './commands/handlers/save-preset-criterion.handler';
import { JobPresetService } from './job-preset.service';

/**
 * The job preset routes reach raw TypeORM repositories, which scope nothing to the tenant. A preset or criterion id
 * of another tenant was read, deleted, or, through `save` with that id, updated and moved into the caller's tenant.
 * Every id from a request must now name a row of the caller's tenant.
 */
const repository = (found: unknown = null) => ({
	findOneBy: jest.fn().mockResolvedValue(found),
	findOne: jest.fn().mockResolvedValue(found),
	findBy: jest.fn().mockResolvedValue([]),
	save: jest.fn(),
	delete: jest.fn()
});

beforeEach(() => {
	mockContext.tenantId = 'tenant-1';
	mockContext.hasPermission = true;
});

describe('CreateJobPresetHandler', () => {
	const build = (existingPreset: unknown) => {
		const presets = repository(existingPreset);
		const criteria = repository();
		return { handler: new CreateJobPresetHandler(presets as any, criteria as any), presets, criteria };
	};

	it("refuses an id that names another tenant's preset, and saves nothing", async () => {
		const { handler, presets } = build(null);

		await expect(
			handler.execute(new CreateJobPresetCommand({ id: 'foreign-preset', name: 'x', employees: [] } as any))
		).rejects.toBeInstanceOf(NotFoundException);
		expect(presets.findOneBy).toHaveBeenCalledWith({ id: 'foreign-preset', tenantId: 'tenant-1' });
		expect(presets.save).not.toHaveBeenCalled();
	});

	it("updates a preset of the caller's tenant", async () => {
		const { handler, presets } = build({ id: 'own-preset', tenantId: 'tenant-1' });

		await handler.execute(new CreateJobPresetCommand({ id: 'own-preset', name: 'x', employees: [] } as any));

		expect(presets.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'own-preset', tenantId: 'tenant-1' }));
	});

	it("saves the preset's criteria as new rows of the preset's tenant and organization", async () => {
		const { handler, criteria } = build(null);

		await handler.execute(
			new CreateJobPresetCommand({
				name: 'x',
				organizationId: 'organization-1',
				tenantId: 'tenant-2',
				employees: [],
				jobPresetCriterions: [{ id: 'foreign-criterion', tenantId: 'tenant-2', keyword: 'angular' }]
			} as any)
		);

		const [saved] = criteria.save.mock.calls[0][0];
		expect(saved.id).toBeUndefined();
		expect(saved).toMatchObject({ keyword: 'angular', tenantId: 'tenant-1', organizationId: 'organization-1' });
	});

	it('fails closed without a tenant', async () => {
		mockContext.tenantId = null;
		const { handler, presets } = build(null);

		await expect(
			handler.execute(new CreateJobPresetCommand({ name: 'x', tenantId: 'tenant-2', employees: [] } as any))
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(presets.save).not.toHaveBeenCalled();
	});
});

describe('SavePresetCriterionHandler', () => {
	const build = (preset: unknown, criterion: unknown = null) => {
		const presets = repository(preset);
		const criteria = repository(criterion);
		const handler = new SavePresetCriterionHandler(repository() as any, criteria as any, presets as any);
		return { handler, presets, criteria };
	};

	it('refuses a preset of another tenant, and saves nothing', async () => {
		const { handler, presets, criteria } = build(null);

		await expect(
			handler.execute(new SavePresetCriterionCommand({ jobPresetId: 'foreign-preset', keyword: 'x' } as any))
		).rejects.toBeInstanceOf(NotFoundException);
		expect(presets.findOneBy).toHaveBeenCalledWith({ id: 'foreign-preset', tenantId: 'tenant-1' });
		expect(criteria.save).not.toHaveBeenCalled();
	});

	it("refuses a criterion id that is not one of the preset's own", async () => {
		const { handler, criteria } = build({ id: 'own-preset', organizationId: 'organization-1' }, null);

		await expect(
			handler.execute(
				new SavePresetCriterionCommand({ id: 'foreign-criterion', jobPresetId: 'own-preset' } as any)
			)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(criteria.findOneBy).toHaveBeenCalledWith({
			id: 'foreign-criterion',
			jobPresetId: 'own-preset',
			tenantId: 'tenant-1'
		});
		expect(criteria.save).not.toHaveBeenCalled();
	});

	it("saves a criterion of the caller's own preset", async () => {
		const { handler, criteria } = build({ id: 'own-preset', organizationId: 'organization-1' });

		await handler.execute(
			new SavePresetCriterionCommand({
				jobPresetId: 'own-preset',
				organizationId: 'organization-1',
				keyword: 'x'
			} as any)
		);

		expect(criteria.save).toHaveBeenCalledWith(
			expect.objectContaining({ jobPresetId: 'own-preset', tenantId: 'tenant-1' })
		);
	});
});

describe('SaveEmployeeCriterionHandler', () => {
	const employee = { id: 'employee-1', organizationId: 'organization-1' };

	const build = (preset: unknown, criterion: unknown = null) => {
		const criteria = repository(criterion);
		const presets = repository(preset);
		const handler = new SaveEmployeeCriterionHandler(
			repository(employee) as any,
			criteria as any,
			{ syncGauzyEmployeeJobSearchCriteria: jest.fn() } as any,
			presets as any
		);
		return { handler, criteria, presets };
	};

	it('refuses a preset of another tenant', async () => {
		const { handler, criteria } = build(null);

		await expect(
			handler.execute(
				new SaveEmployeeCriterionCommand({ employeeId: 'employee-1', jobPresetId: 'foreign-preset' } as any)
			)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(criteria.save).not.toHaveBeenCalled();
	});

	it("refuses a criterion id that is not one of the employee's own", async () => {
		const { handler, criteria } = build({ id: 'own-preset' }, null);

		await expect(
			handler.execute(
				new SaveEmployeeCriterionCommand({
					id: 'foreign-criterion',
					employeeId: 'employee-1',
					jobPresetId: 'own-preset'
				} as any)
			)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(criteria.findOneBy).toHaveBeenCalledWith({
			id: 'foreign-criterion',
			employeeId: 'employee-1',
			tenantId: 'tenant-1'
		});
		expect(criteria.save).not.toHaveBeenCalled();
	});

	it('fails closed without a tenant, even when the body names one', async () => {
		mockContext.tenantId = null;
		const { handler, criteria } = build({ id: 'own-preset' });

		await expect(
			handler.execute(new SaveEmployeeCriterionCommand({ employeeId: 'employee-1', tenantId: 'tenant-2' } as any))
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(criteria.save).not.toHaveBeenCalled();
	});
});

describe('JobPresetService', () => {
	const build = () => {
		const presetCriteria = repository();
		const employeeCriteria = repository();
		const employees = repository(null);
		const service = new JobPresetService(
			{} as any,
			{} as any,
			presetCriteria as any,
			employeeCriteria as any,
			employees as any,
			{} as any
		);
		return { service, presetCriteria, employeeCriteria, employees };
	};

	it("deletes a preset criterion of the caller's tenant only", async () => {
		const { service, presetCriteria } = build();

		await service.deleteJobPresetCriterion('criterion-1');

		expect(presetCriteria.delete).toHaveBeenCalledWith({ id: 'criterion-1', tenantId: 'tenant-1' });
	});

	it("deletes an employee criterion of the caller's tenant only", async () => {
		const { service, employeeCriteria } = build();

		await service.deleteEmployeeCriterion('criterion-1', 'employee-1');

		expect(employeeCriteria.delete).toHaveBeenCalledWith({
			id: 'criterion-1',
			employeeId: 'employee-1',
			tenantId: 'tenant-1'
		});
	});

	it("reads the criteria of the caller's tenant only", async () => {
		const { service, presetCriteria, employeeCriteria } = build();

		await service.getJobPresetCriterion('preset-1');
		await service.getEmployeeCriterion({ employeeId: 'employee-1' });

		expect(presetCriteria.findBy).toHaveBeenCalledWith({ jobPresetId: 'preset-1', tenantId: 'tenant-1' });
		expect(employeeCriteria.findBy).toHaveBeenCalledWith({ employeeId: 'employee-1', tenantId: 'tenant-1' });
	});

	it("answers 404 for the presets of another tenant's employee", async () => {
		const { service, employees } = build();

		await expect(service.getEmployeePreset('foreign-employee')).rejects.toBeInstanceOf(NotFoundException);
		expect(employees.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'foreign-employee', tenantId: 'tenant-1' } })
		);
	});

	it('queries nothing without a tenant', async () => {
		mockContext.tenantId = null;
		const { service, presetCriteria } = build();

		await expect(service.deleteJobPresetCriterion('criterion-1')).rejects.toBeInstanceOf(ForbiddenException);
		expect(presetCriteria.delete).not.toHaveBeenCalled();
	});
});
