import { ArgumentMetadata, BadRequestException, Type, ValidationPipe } from '@nestjs/common';
import { ITimerToggleInput, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';

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

// The DTOs pick members of the TimeLog entity, so the entity graph has to finish loading first.
import '../../../core/entities/internal';

import { StopTimerDTO } from './stop-timer.dto';
import { ToggleTimerDTO } from './toggle-timer.dto';

/**
 * A stop or a toggle may name the running time log it is for (`timeLogId`), so that a view still showing an earlier
 * run cannot end a newer one. The two routes validate their body with the pipe the controller mounts, a
 * `ValidationPipe` without options: a member the DTO declares is checked, any other would pass unchecked.
 */
const BODY = {
	organizationId: '00000000-0000-4000-8000-000000000001',
	source: TimeLogSourceEnum.TEAMS,
	// The toggle body is the start's, which requires a log type
	logType: TimeLogType.TRACKED
};

const TIME_LOG_ID = '00000000-0000-4000-8000-000000000020';

async function validateBody(
	metatype: Type<ITimerToggleInput>,
	body: Record<string, unknown>
): Promise<ITimerToggleInput> {
	const pipe = new ValidationPipe();
	const metadata: ArgumentMetadata = { type: 'body', metatype };

	return pipe.transform(body, metadata);
}

describe.each([
	['StopTimerDTO', StopTimerDTO],
	['ToggleTimerDTO', ToggleTimerDTO]
])('%s', (_name: string, metatype: Type<ITimerToggleInput>) => {
	it('accepts the time log the body names', async () => {
		const body = await validateBody(metatype, { ...BODY, timeLogId: TIME_LOG_ID });

		expect(body.timeLogId).toBe(TIME_LOG_ID);
	});

	it('refuses a time log id that is not a UUID with a 400', async () => {
		const attempt = validateBody(metatype, { ...BODY, timeLogId: 'log-running' });

		await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
	});

	it('accepts a body that names no time log, as every client sends it today', async () => {
		const body = await validateBody(metatype, BODY);

		expect(body.timeLogId).toBeUndefined();
	});
});
