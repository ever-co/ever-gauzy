import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';

/**
 * The organization membership check needs a request context and a database, and this suite has neither. It passes
 * here, so a refusal can only come from the body itself.
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

// The DTO picks members of the TimeLog entity, so the entity graph has to finish loading first.
import '../../../core/entities/internal';

import { StartTimerDTO } from './start-timer.dto';

/**
 * The timer routes validate their body with `whitelist: true`, so a field the DTO does not declare is dropped
 * before the service reads it.
 */
const START_BODY = {
	organizationId: '00000000-0000-4000-8000-000000000001',
	organizationTeamId: '00000000-0000-4000-8000-000000000002',
	source: TimeLogSourceEnum.TEAMS,
	logType: TimeLogType.TRACKED
};

async function validateBody(body: Record<string, unknown>): Promise<StartTimerDTO> {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype: StartTimerDTO };

	return pipe.transform(body, metadata);
}

describe('StartTimerDTO', () => {
	it("keeps the member's plan day", async () => {
		const dto = await validateBody({ ...START_BODY, planDay: '2026-11-05' });

		expect(dto.planDay).toBe('2026-11-05');
	});

	it('refuses a plan day that is not a YYYY-MM-DD date with a 400', async () => {
		const attempt = validateBody({ ...START_BODY, planDay: '2026-11-05T00:00:00Z' });

		await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
	});

	it('accepts a start without a plan day, as every other client sends it', async () => {
		const dto = await validateBody(START_BODY);

		expect(dto.planDay).toBeUndefined();
	});
});
