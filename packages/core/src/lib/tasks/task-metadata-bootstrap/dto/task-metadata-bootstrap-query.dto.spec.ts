import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';

let mockOrganizationBelongsToUser = true;

jest.mock('../../../shared/validators/constraints', () => {
	const { ValidatorConstraint } = jest.requireActual('class-validator') as typeof import('class-validator');

	class OrganizationBelongsToUserConstraint {
		async validate(): Promise<boolean> {
			return mockOrganizationBelongsToUser;
		}
	}

	class PassingConstraint {
		async validate(): Promise<boolean> {
			return true;
		}
	}

	ValidatorConstraint({ name: 'IsOrganizationBelongsToUser', async: true })(OrganizationBelongsToUserConstraint);
	ValidatorConstraint({ name: 'PassingConstraint', async: true })(PassingConstraint);

	return {
		EmployeeBelongsToOrganizationConstraint: PassingConstraint,
		ExpenseCategoryAlreadyExistConstraint: PassingConstraint,
		OrganizationBelongsToUserConstraint,
		RoleAlreadyExistConstraint: PassingConstraint,
		RoleShouldExistConstraint: PassingConstraint,
		TeamAlreadyExistConstraint: PassingConstraint,
		TenantBelongsToUserConstraint: PassingConstraint
	};
});

import { TaskMetadataBootstrapQueryDTO } from './task-metadata-bootstrap-query.dto';

const VALID_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const VALID_TEAM_ID = '00000000-0000-4000-8000-000000000002';
const VALID_PROJECT_ID = '00000000-0000-4000-8000-000000000003';
const VALID_TENANT_ID = '00000000-0000-4000-8000-000000000004';

const queryMetadata: ArgumentMetadata = {
	type: 'query',
	metatype: TaskMetadataBootstrapQueryDTO
};

async function transformQuery(payload: Record<string, unknown>): Promise<TaskMetadataBootstrapQueryDTO> {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });

	return pipe.transform(payload, queryMetadata) as Promise<TaskMetadataBootstrapQueryDTO>;
}

async function expectInvalid(payload: Record<string, unknown>): Promise<void> {
	await expect(transformQuery(payload)).rejects.toBeInstanceOf(BadRequestException);
}

describe('TaskMetadataBootstrapQueryDTO', () => {
	beforeEach(() => {
		mockOrganizationBelongsToUser = true;
	});

	it('keeps include undefined when it is omitted', async () => {
		const dto = await transformQuery({ organizationId: VALID_ORGANIZATION_ID });

		expect(dto.include).toBeUndefined();
	});

	it('splits and trims comma-separated include values', async () => {
		const dto = await transformQuery({
			organizationId: VALID_ORGANIZATION_ID,
			include: ' taskStatuses, taskLabels ,issueTypes '
		});

		expect(dto.include).toEqual(['taskStatuses', 'taskLabels', 'issueTypes']);
	});

	it('stable-deduplicates include values without mutating the caller array', async () => {
		const include = [' taskLabels,taskStatuses ', 'taskLabels', ' issueTypes,taskStatuses'];
		const originalInclude = [...include];

		const dto = await transformQuery({ organizationId: VALID_ORGANIZATION_ID, include });

		expect(dto.include).toEqual(['taskLabels', 'taskStatuses', 'issueTypes']);
		expect(include).toEqual(originalInclude);
	});

	it('flattens repeated query-array values before validation', async () => {
		const dto = await transformQuery({
			organizationId: VALID_ORGANIZATION_ID,
			include: ['taskStatuses, taskPriorities', ' taskSizes']
		});

		expect(dto.include).toEqual(['taskStatuses', 'taskPriorities', 'taskSizes']);
	});

	it('accepts all seven supported metadata sections', async () => {
		const include = [
			'taskStatuses',
			'taskPriorities',
			'taskSizes',
			'taskLabels',
			'taskVersions',
			'issueTypes',
			'relatedIssueTypes'
		];

		const dto = await transformQuery({ organizationId: VALID_ORGANIZATION_ID, include });

		expect(dto.include).toEqual(include);
	});

	it.each([
		['empty', ''],
		['whitespace-only', '   '],
		['interior-empty', 'taskStatuses,,taskLabels'],
		['unknown', 'taskStatuses,unknown'],
		['wrong-case', 'TaskStatuses'],
		['empty array', []]
	])('rejects %s include input', async (_case, include) => {
		await expectInvalid({ organizationId: VALID_ORGANIZATION_ID, include });
	});

	it('requires an organization UUID', async () => {
		await expectInvalid({});
	});

	it('retains organization membership validation', async () => {
		mockOrganizationBelongsToUser = false;

		await expectInvalid({ organizationId: VALID_ORGANIZATION_ID });
	});

	it('accepts optional organization team and project UUIDs', async () => {
		const dto = await transformQuery({
			organizationId: VALID_ORGANIZATION_ID,
			organizationTeamId: VALID_TEAM_ID,
			projectId: VALID_PROJECT_ID
		});

		expect(dto.organizationTeamId).toBe(VALID_TEAM_ID);
		expect(dto.projectId).toBe(VALID_PROJECT_ID);
	});

	it.each(['organizationId', 'organizationTeamId', 'projectId'])('rejects an invalid %s UUID', async (property) => {
		await expectInvalid({ organizationId: VALID_ORGANIZATION_ID, [property]: 'not-a-uuid' });
	});

	it('strips a request-supplied tenantId through the real transform and whitelist pipe', async () => {
		const dto = await transformQuery({
			organizationId: VALID_ORGANIZATION_ID,
			tenantId: VALID_TENANT_ID
		});

		expect(dto).not.toHaveProperty('tenantId');
	});
});
