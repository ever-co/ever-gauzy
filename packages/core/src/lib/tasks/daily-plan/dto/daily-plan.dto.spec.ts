import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { DailyPlanStatusEnum } from '@gauzy/contracts';

/**
 * The organization and employee membership checks need a request context and a database, and this
 * suite has neither. They pass here, so a refusal can only come from the body itself.
 */
jest.mock('../../../shared/validators/constraints', () => {
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

/**
 * The update DTO picks a member of the DailyPlan entity, so the entity graph has to finish loading
 * before the DTOs do.
 */
import '../../../core/entities/internal';

import { CreateDailyPlanDTO } from './create-daily-plan.dto';
import { UpdateDailyPlanDTO } from './update-daily-plan.dto';

/**
 * `POST /daily-plan` and `PUT /daily-plan/:id` stored any number as `workTimePlanned`, so a plan could
 * show a planned time such as -5h (#11457). Both routes run
 * `@UseValidationPipe({ transform: true, whitelist: true })` over their body, and so does this suite.
 */

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-8000-000000000002';
const ORGANIZATION_TEAM_ID = '00000000-0000-4000-8000-000000000003';

/** A plan as a client creates it, without the planned time under test. */
const CREATE_BODY = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID,
	organizationTeamId: ORGANIZATION_TEAM_ID,
	date: '2026-10-25T00:00:00.000Z',
	status: DailyPlanStatusEnum.OPEN
};

/** An update names the plan's employee and sends only the fields it changes. */
const UPDATE_BODY = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID
};

type DailyPlanDTOClass = typeof CreateDailyPlanDTO | typeof UpdateDailyPlanDTO;

async function validateBody(
	metatype: DailyPlanDTOClass,
	body: Record<string, unknown>
): Promise<InstanceType<DailyPlanDTOClass>> {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype };

	return pipe.transform(body, metadata);
}

/** The 400 the pipe answers with, or `undefined` when it lets the body through. */
async function refusalOf(
	metatype: DailyPlanDTOClass,
	body: Record<string, unknown>
): Promise<BadRequestException | undefined> {
	try {
		await validateBody(metatype, body);
	} catch (error) {
		if (error instanceof BadRequestException) {
			return error;
		}
		throw error;
	}

	return undefined;
}

describe.each([
	['CreateDailyPlanDTO (POST /daily-plan)', CreateDailyPlanDTO, CREATE_BODY],
	['UpdateDailyPlanDTO (PUT /daily-plan/:id)', UpdateDailyPlanDTO, UPDATE_BODY]
] as const)('%s', (_name, DTOClass, body) => {
	it('refuses a negative workTimePlanned with a 400', async () => {
		const negativeBody = { ...body, workTimePlanned: -1 };
		const refusal = await refusalOf(DTOClass, negativeBody);
		const status = refusal?.getStatus();
		const response = refusal?.getResponse();

		expect(status).toBe(400);
		expect(response).toMatchObject({ message: ['workTimePlanned must not be less than 0'] });
	});

	it.each([0, 8])('accepts a workTimePlanned of %s', async (workTimePlanned) => {
		const plannedBody = { ...body, workTimePlanned };
		const dto = await validateBody(DTOClass, plannedBody);

		expect(dto.workTimePlanned).toBe(workTimePlanned);
	});
});

describe('UpdateDailyPlanDTO (PUT /daily-plan/:id)', () => {
	it('accepts an update that does not send workTimePlanned', async () => {
		const statusOnlyBody = { ...UPDATE_BODY, status: DailyPlanStatusEnum.COMPLETED };
		const dto = await validateBody(UpdateDailyPlanDTO, statusOnlyBody);

		expect(dto.workTimePlanned).toBeUndefined();
	});
});
