import { ArgumentMetadata, BadRequestException, Type, ValidationPipe } from '@nestjs/common';
import { TimesheetStatus } from '@gauzy/contracts';

/**
 * The organization and tenant membership checks need a request context and a database, and this suite has
 * neither. They pass here, so a refusal can only come from the `ids` list.
 */
jest.mock('../../../../shared/validators/constraints', () => {
	const { ValidatorConstraint } = jest.requireActual<typeof import('class-validator')>('class-validator');

	class PassingConstraint {
		async validate(): Promise<boolean> {
			return true;
		}
	}

	const asAsyncConstraint = ValidatorConstraint({ name: 'PassingConstraint', async: true });

	asAsyncConstraint(PassingConstraint);

	return {
		EmployeeBelongsToOrganizationConstraint: PassingConstraint,
		ExpenseCategoryAlreadyExistConstraint: PassingConstraint,
		OrganizationBelongsToUserConstraint: PassingConstraint,
		RoleAlreadyExistConstraint: PassingConstraint,
		RoleShouldExistConstraint: PassingConstraint,
		TeamAlreadyExistConstraint: PassingConstraint,
		TenantBelongsToUserConstraint: PassingConstraint
	};
});

// The status DTO picks members of the Timesheet entity, so the entity graph has to finish loading first.
import '../../../../core/entities/internal';

import { SubmitTimesheetStatusDTO } from './submit-timesheet-status.dto';
import { UpdateTimesheetStatusDTO } from './update-timesheet-status.dto';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const TIMESHEET_ID = '00000000-0000-4000-8000-000000000030';

/** The ids of `count` distinct timesheets. */
function timesheetIds(count: number): string[] {
	return Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
}

async function validateBody(metatype: Type<{ ids: string[] }>, body: Record<string, unknown>) {
	const pipe = new ValidationPipe({ whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype };

	return pipe.transform(body, metadata);
}

describe.each([
	['SubmitTimesheetStatusDTO', SubmitTimesheetStatusDTO, { status: 'submit' }],
	['UpdateTimesheetStatusDTO', UpdateTimesheetStatusDTO, { status: TimesheetStatus.APPROVED }]
])('%s ids', (_name: string, metatype: Type<{ ids: string[] }>, extra: Record<string, unknown>) => {
	const body = (ids: unknown) => ({ organizationId: ORGANIZATION_ID, ...extra, ids });

	it('accepts one timesheet id', async () => {
		const result = await validateBody(metatype, body([TIMESHEET_ID]));

		expect(result.ids).toEqual([TIMESHEET_ID]);
	});

	it('keeps accepting a large bulk selection, as before', async () => {
		const result = await validateBody(metatype, body(timesheetIds(1000)));

		expect(result.ids).toHaveLength(1000);
	});

	it('refuses an id that is not a UUID with a 400 instead of reaching the database', async () => {
		const attempt = validateBody(metatype, body([TIMESHEET_ID, 'not-a-uuid']));

		await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
	});

	it('keeps refusing an empty list and a missing list', async () => {
		await expect(validateBody(metatype, body([]))).rejects.toBeInstanceOf(BadRequestException);
		await expect(validateBody(metatype, body(undefined))).rejects.toBeInstanceOf(BadRequestException);
	});
});
