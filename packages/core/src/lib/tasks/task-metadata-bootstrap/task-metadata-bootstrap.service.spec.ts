jest.mock('../../tags/tag.service', () => {
	class TagService {}

	return { TagService };
});

jest.mock('../issue-type/issue-type.service', () => {
	class IssueTypeService {}

	return { IssueTypeService };
});

jest.mock('../priorities/priority.service', () => {
	class TaskPriorityService {}

	return { TaskPriorityService };
});

jest.mock('../related-issue-type/related-issue-type.service', () => {
	class TaskRelatedIssueTypeService {}

	return { TaskRelatedIssueTypeService };
});

jest.mock('../sizes/size.service', () => {
	class TaskSizeService {}

	return { TaskSizeService };
});

jest.mock('../statuses/status.service', () => {
	class TaskStatusService {}

	return { TaskStatusService };
});

jest.mock('../versions/version.service', () => {
	class TaskVersionService {}

	return { TaskVersionService };
});

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
	IIssueType,
	IPagination,
	ITag,
	ITaskMetadataBootstrapQuery,
	ITaskPriority,
	ITaskRelatedIssueType,
	ITaskSize,
	ITaskStatus,
	ITaskVersion,
	TASK_METADATA_SECTIONS,
	TaskMetadataSection
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TagService } from '../../tags/tag.service';
import { IssueTypeService } from '../issue-type/issue-type.service';
import { TaskPriorityService } from '../priorities/priority.service';
import { TaskRelatedIssueTypeService } from '../related-issue-type/related-issue-type.service';
import { TaskSizeService } from '../sizes/size.service';
import { TaskStatusService } from '../statuses/status.service';
import { TaskVersionService } from '../versions/version.service';
import { TaskMetadataBootstrapService } from './task-metadata-bootstrap.service';

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});

	return { promise, resolve };
}

describe('TaskMetadataBootstrapService', () => {
	const tenantId = '6241d0c9-999c-4de8-944d-20a32e1907ce';
	const organizationId = '27d9c044-e8fb-4bd5-9382-89bda747fbbb';
	const organizationTeamId = 'da850d71-a95b-41bf-bfe5-3e4b882a255b';
	const projectId = 'b33ab770-e0f8-4d7d-b49c-a451d75b9198';

	const taskStatuses: IPagination<ITaskStatus> = { items: [], total: 11 };
	const taskPriorities: IPagination<ITaskPriority> = { items: [], total: 12 };
	const taskSizes: IPagination<ITaskSize> = { items: [], total: 13 };
	const taskLabels: IPagination<ITag> = { items: [], total: 14 };
	const taskVersions: IPagination<ITaskVersion> = { items: [], total: 15 };
	const issueTypes: IPagination<IIssueType> = { items: [], total: 16 };
	const relatedIssueTypes: IPagination<ITaskRelatedIssueType> = { items: [], total: 17 };

	let service: TaskMetadataBootstrapService;
	let currentTenantId: jest.SpyInstance;
	let taskStatusService: jest.Mocked<Pick<TaskStatusService, 'fetchAll'>>;
	let taskPriorityService: jest.Mocked<Pick<TaskPriorityService, 'fetchAll'>>;
	let taskSizeService: jest.Mocked<Pick<TaskSizeService, 'fetchAll'>>;
	let tagService: jest.Mocked<Pick<TagService, 'findTagsByLevel'>>;
	let taskVersionService: jest.Mocked<Pick<TaskVersionService, 'fetchAll'>>;
	let issueTypeService: jest.Mocked<Pick<IssueTypeService, 'fetchAll'>>;
	let taskRelatedIssueTypeService: jest.Mocked<Pick<TaskRelatedIssueTypeService, 'fetchAll'>>;
	let loaderMocks: Array<{ mock: { invocationCallOrder: number[] } }>;

	beforeEach(() => {
		currentTenantId = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);
		taskStatusService = { fetchAll: jest.fn().mockResolvedValue(taskStatuses) };
		taskPriorityService = { fetchAll: jest.fn().mockResolvedValue(taskPriorities) };
		taskSizeService = { fetchAll: jest.fn().mockResolvedValue(taskSizes) };
		tagService = { findTagsByLevel: jest.fn().mockResolvedValue(taskLabels) };
		taskVersionService = { fetchAll: jest.fn().mockResolvedValue(taskVersions) };
		issueTypeService = { fetchAll: jest.fn().mockResolvedValue(issueTypes) };
		taskRelatedIssueTypeService = { fetchAll: jest.fn().mockResolvedValue(relatedIssueTypes) };

		loaderMocks = [
			taskStatusService.fetchAll,
			taskPriorityService.fetchAll,
			taskSizeService.fetchAll,
			tagService.findTagsByLevel,
			taskVersionService.fetchAll,
			issueTypeService.fetchAll,
			taskRelatedIssueTypeService.fetchAll
		];

		service = new TaskMetadataBootstrapService(
			taskStatusService as unknown as TaskStatusService,
			taskPriorityService as unknown as TaskPriorityService,
			taskSizeService as unknown as TaskSizeService,
			tagService as unknown as TagService,
			taskVersionService as unknown as TaskVersionService,
			issueTypeService as unknown as IssueTypeService,
			taskRelatedIssueTypeService as unknown as TaskRelatedIssueTypeService
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function expectNoLoaderCalls(): void {
		for (const loader of loaderMocks) {
			expect(loader).not.toHaveBeenCalled();
		}
	}

	it('rejects generically before validation or loader calls when the tenant context is missing', async () => {
		currentTenantId.mockReturnValue(null);
		const query = {
			organizationId,
			include: ['taskStatuses', 'unknown-section']
		} as unknown as ITaskMetadataBootstrapQuery;

		let thrown: unknown;
		try {
			await service.bootstrap(query);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ForbiddenException);
		expect((thrown as ForbiddenException).getResponse()).toStrictEqual(new ForbiddenException().getResponse());
		expect(currentTenantId).toHaveBeenCalledTimes(1);
		expectNoLoaderCalls();
	});

	it('loads all seven sections in canonical order with one exact captured scope', async () => {
		const result = await service.bootstrap({ organizationId, organizationTeamId, projectId });

		expect(Object.keys(result)).toStrictEqual([...TASK_METADATA_SECTIONS]);
		expect(result.taskStatuses).toBe(taskStatuses);
		expect(result.taskStatuses?.total).toBe(11);
		expect(result.taskPriorities).toBe(taskPriorities);
		expect(result.taskPriorities?.total).toBe(12);
		expect(result.taskSizes).toBe(taskSizes);
		expect(result.taskSizes?.total).toBe(13);
		expect(result.taskLabels).toBe(taskLabels);
		expect(result.taskLabels?.total).toBe(14);
		expect(result.taskVersions).toBe(taskVersions);
		expect(result.taskVersions?.total).toBe(15);
		expect(result.issueTypes).toBe(issueTypes);
		expect(result.issueTypes?.total).toBe(16);
		expect(result.relatedIssueTypes).toBe(relatedIssueTypes);
		expect(result.relatedIssueTypes?.total).toBe(17);

		expect(currentTenantId).toHaveBeenCalledTimes(1);
		const contextOrder = currentTenantId.mock.invocationCallOrder[0];
		for (const loader of loaderMocks) {
			expect(loader).toHaveBeenCalledTimes(1);
			expect(contextOrder).toBeLessThan(loader.mock.invocationCallOrder[0]);
		}

		const expectedScope = { tenantId, organizationId, organizationTeamId, projectId };
		const capturedScope = taskStatusService.fetchAll.mock.calls[0][0];
		expect(taskStatusService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskPriorityService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskSizeService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskVersionService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(issueTypeService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskRelatedIssueTypeService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskPriorityService.fetchAll.mock.calls[0][0]).toBe(capturedScope);
		expect(taskSizeService.fetchAll.mock.calls[0][0]).toBe(capturedScope);
		expect(taskVersionService.fetchAll.mock.calls[0][0]).toBe(capturedScope);
		expect(issueTypeService.fetchAll.mock.calls[0][0]).toBe(capturedScope);
		expect(taskRelatedIssueTypeService.fetchAll.mock.calls[0][0]).toBe(capturedScope);
		expect(tagService.findTagsByLevel.mock.calls[0]).toStrictEqual([{ organizationId, organizationTeamId }]);
	});

	it('loads and returns only a requested partial selection', async () => {
		const result = await service.bootstrap({
			organizationId,
			organizationTeamId,
			projectId,
			include: ['relatedIssueTypes', 'taskLabels']
		});

		expect(Object.keys(result)).toStrictEqual(['relatedIssueTypes', 'taskLabels']);
		expect(result.relatedIssueTypes).toBe(relatedIssueTypes);
		expect(result.taskLabels).toBe(taskLabels);
		expect(taskRelatedIssueTypeService.fetchAll).toHaveBeenCalledTimes(1);
		expect(tagService.findTagsByLevel).toHaveBeenCalledTimes(1);
		expect(taskStatusService.fetchAll).not.toHaveBeenCalled();
		expect(taskPriorityService.fetchAll).not.toHaveBeenCalled();
		expect(taskSizeService.fetchAll).not.toHaveBeenCalled();
		expect(taskVersionService.fetchAll).not.toHaveBeenCalled();
		expect(issueTypeService.fetchAll).not.toHaveBeenCalled();
	});

	it('passes absent optional scope keys explicitly to all six scoped loaders', async () => {
		await service.bootstrap({ organizationId });

		const expectedScope = {
			tenantId,
			organizationId,
			organizationTeamId: undefined,
			projectId: undefined
		};
		expect(taskStatusService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskPriorityService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskSizeService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskVersionService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(issueTypeService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(taskRelatedIssueTypeService.fetchAll.mock.calls[0]).toStrictEqual([expectedScope]);
		expect(tagService.findTagsByLevel.mock.calls[0]).toStrictEqual([
			{ organizationId, organizationTeamId: undefined }
		]);
	});

	it('returns an empty object without calling loaders for an empty selection', async () => {
		const result = await service.bootstrap({ organizationId, include: [] });

		expect(result).toStrictEqual({});
		expect(currentTenantId).toHaveBeenCalledTimes(1);
		expectNoLoaderCalls();
	});

	it('starts every selected loader before any deferred result resolves', async () => {
		const statusDeferred = deferred<typeof taskStatuses>();
		const priorityDeferred = deferred<typeof taskPriorities>();
		const sizeDeferred = deferred<typeof taskSizes>();
		const labelDeferred = deferred<typeof taskLabels>();
		const versionDeferred = deferred<typeof taskVersions>();
		const issueTypeDeferred = deferred<typeof issueTypes>();
		const relatedIssueTypeDeferred = deferred<typeof relatedIssueTypes>();
		const started: TaskMetadataSection[] = [];

		taskStatusService.fetchAll.mockImplementation(() => {
			started.push('taskStatuses');
			return statusDeferred.promise;
		});
		taskPriorityService.fetchAll.mockImplementation(() => {
			started.push('taskPriorities');
			return priorityDeferred.promise;
		});
		taskSizeService.fetchAll.mockImplementation(() => {
			started.push('taskSizes');
			return sizeDeferred.promise;
		});
		tagService.findTagsByLevel.mockImplementation(() => {
			started.push('taskLabels');
			return labelDeferred.promise;
		});
		taskVersionService.fetchAll.mockImplementation(() => {
			started.push('taskVersions');
			return versionDeferred.promise;
		});
		issueTypeService.fetchAll.mockImplementation(() => {
			started.push('issueTypes');
			return issueTypeDeferred.promise;
		});
		taskRelatedIssueTypeService.fetchAll.mockImplementation(() => {
			started.push('relatedIssueTypes');
			return relatedIssueTypeDeferred.promise;
		});

		const resultPromise = service.bootstrap({ organizationId });

		expect(started).toStrictEqual([...TASK_METADATA_SECTIONS]);

		statusDeferred.resolve(taskStatuses);
		priorityDeferred.resolve(taskPriorities);
		sizeDeferred.resolve(taskSizes);
		labelDeferred.resolve(taskLabels);
		versionDeferred.resolve(taskVersions);
		issueTypeDeferred.resolve(issueTypes);
		relatedIssueTypeDeferred.resolve(relatedIssueTypes);

		await expect(resultPromise).resolves.toStrictEqual({
			taskStatuses,
			taskPriorities,
			taskSizes,
			taskLabels,
			taskVersions,
			issueTypes,
			relatedIssueTypes
		});
	});

	it('rejects the whole selection with the original loader error and does not retry', async () => {
		const error = new Error('priority loader failed');
		taskPriorityService.fetchAll.mockRejectedValue(error);

		const resultPromise = service.bootstrap({
			organizationId,
			include: ['taskStatuses', 'taskPriorities']
		});

		await expect(resultPromise).rejects.toBe(error);
		expect(taskStatusService.fetchAll).toHaveBeenCalledTimes(1);
		expect(taskPriorityService.fetchAll).toHaveBeenCalledTimes(1);
		expect(taskSizeService.fetchAll).not.toHaveBeenCalled();
		expect(tagService.findTagsByLevel).not.toHaveBeenCalled();
		expect(taskVersionService.fetchAll).not.toHaveBeenCalled();
		expect(issueTypeService.fetchAll).not.toHaveBeenCalled();
		expect(taskRelatedIssueTypeService.fetchAll).not.toHaveBeenCalled();
	});

	it('rejects a mixed valid and unknown section before starting any loader', async () => {
		const query = {
			organizationId,
			include: ['taskStatuses', 'unknown-section']
		} as unknown as ITaskMetadataBootstrapQuery;

		await expect(service.bootstrap(query)).rejects.toBeInstanceOf(BadRequestException);
		expect(currentTenantId).toHaveBeenCalledTimes(1);
		expectNoLoaderCalls();
	});
});
