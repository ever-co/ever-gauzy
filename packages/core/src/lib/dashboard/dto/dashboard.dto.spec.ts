import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDashboardDTO } from './create-dashboard.dto';
import { UpdateDashboardDTO } from './update-dashboard.dto';

/**
 * The employee rules of a dashboard payload. The organization-membership check moved from the
 * `Dashboard` entity to these DTOs, and class-validator drops an inherited rule when a subclass
 * declares one of the same kind on the same property — so the entity's `@IsObject()` / `@IsUUID()`
 * are declared again beside it. Without that, both DTOs silently accepted any `employeeId` string and
 * any `employee` value.
 *
 * No organization is named (`sentTo` satisfies `TenantOrganizationBaseDTO`), so the membership check
 * itself passes without a lookup and these payloads need no database.
 */
describe.each([
	['CreateDashboardDTO', CreateDashboardDTO],
	['UpdateDashboardDTO', UpdateDashboardDTO]
])('%s employee rules', (_name, dto) => {
	const failedRules = async (body: object, property: string): Promise<string[]> => {
		const errors = await validate(
			plainToInstance(dto, { name: 'Dashboard', sentTo: 'recipient', ...body }) as object
		);
		return Object.keys(errors.find((error) => error.property === property)?.constraints ?? {});
	};

	it('rejects an employeeId that is not a UUID', async () => {
		expect(await failedRules({ employeeId: 'not-a-uuid' }, 'employeeId')).toEqual(['isUuid']);
	});

	it('rejects an employee that is not an object', async () => {
		expect(await failedRules({ employee: 'not-an-object' }, 'employee')).toEqual(['isObject']);
	});

	it('accepts a dashboard without an employee', async () => {
		expect(await failedRules({ employee: null, employeeId: null }, 'employee')).toEqual([]);
		expect(await failedRules({ employee: null, employeeId: null }, 'employeeId')).toEqual([]);
	});

	it('accepts a well-formed employeeId', async () => {
		expect(await failedRules({ employeeId: '00000000-0000-4000-8000-000000000001' }, 'employeeId')).toEqual([]);
	});
});
