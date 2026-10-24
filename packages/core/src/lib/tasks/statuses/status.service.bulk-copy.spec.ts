import '../../core/entities/internal';

import { TenantAwareCrudService } from '../../core/crud';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskMetadataService } from '../task-metadata.service';
import { TaskStatusService } from './status.service';

/**
 * Copying the tenant's statuses to a new organization (`bulkCreateOrganizationStatus`) or to a new project or
 * team (`createBulkStatusesByEntity`) dropped `isTodo`, `isInProgress` and `isDone`, so the copied statuses lost
 * the workflow stage they stand for (the tenant defaults carry them). The copies now keep them.
 */
describe('TaskStatusService — copying statuses keeps the workflow flags', () => {
	const fixture = createTenantFixture();
	const source = [
		{ name: 'Open', value: 'open', isTodo: true, isInProgress: false, isDone: false },
		{ name: 'In Progress', value: 'in-progress', isTodo: false, isInProgress: true, isDone: false },
		{ name: 'Done', value: 'done', isTodo: false, isInProgress: false, isDone: true }
	];
	const flagsOf = (statuses: any[]) =>
		statuses.map(({ value, isTodo, isInProgress, isDone }) => ({ value, isTodo, isInProgress, isDone }));

	let restore: () => void;
	let service: TaskStatusService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(TaskMetadataService.prototype, 'fetchAll').mockResolvedValue({
			items: source.map((status) => ({ ...status, tenantId: fixture.tenantId })),
			total: source.length
		} as never);
		service = Object.create(TaskStatusService.prototype);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('bulkCreateOrganizationStatus copies isTodo, isInProgress and isDone', async () => {
		const saveMany = jest
			.spyOn(TenantAwareCrudService.prototype, 'saveMany')
			.mockImplementation(async (entities) => entities as never);

		await service.bulkCreateOrganizationStatus({ id: fixture.organizationId } as never);

		expect(flagsOf(saveMany.mock.calls[0][0])).toEqual(flagsOf(source));
	});

	it('createBulkStatusesByEntity copies isTodo, isInProgress and isDone', async () => {
		const createMany = jest
			.spyOn(TenantAwareCrudService.prototype, 'createMany')
			.mockImplementation(async (entities) => entities as never);

		await service.createBulkStatusesByEntity({ organizationId: fixture.organizationId, projectId: 'project-1' });

		expect(flagsOf(createMany.mock.calls[0][0])).toEqual(flagsOf(source));
	});
});
