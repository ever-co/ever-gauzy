import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ITimerDiscardInput } from '@gauzy/contracts';

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

// The DTO picks a member of the stop DTO, which picks members of the TimeLog entity: the entity graph loads first.
import '../../../core/entities/internal';

import { DiscardTimerDTO } from './discard-timer.dto';

/**
 * Issue #11923 — the discard body: the organization, as every timer write sends it, and optionally the running time
 * log the discard is for. The route validates it with a whitelisting pipe, so nothing else reaches the service.
 */
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const TIME_LOG_ID = '00000000-0000-4000-8000-000000000020';

async function validateBody(body: Record<string, unknown>): Promise<ITimerDiscardInput> {
	const pipe = new ValidationPipe({ whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype: DiscardTimerDTO };

	return pipe.transform(body, metadata);
}

describe('DiscardTimerDTO', () => {
	it('accepts the organization alone, and the running time log the discard is for', async () => {
		await expect(validateBody({ organizationId: ORGANIZATION_ID })).resolves.toMatchObject({
			organizationId: ORGANIZATION_ID
		});
		await expect(validateBody({ organizationId: ORGANIZATION_ID, timeLogId: TIME_LOG_ID })).resolves.toMatchObject({
			timeLogId: TIME_LOG_ID
		});
	});

	it('refuses a time log id that is not a UUID', async () => {
		await expect(validateBody({ organizationId: ORGANIZATION_ID, timeLogId: 'log-1' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('refuses a body without the organization, as the other timer writes do', async () => {
		await expect(validateBody({ timeLogId: TIME_LOG_ID })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('drops what it does not declare', async () => {
		const body = await validateBody({ organizationId: ORGANIZATION_ID, employeeId: 'someone-else', force: true });

		expect(body).not.toHaveProperty('employeeId');
		expect(body).not.toHaveProperty('force');
	});
});
