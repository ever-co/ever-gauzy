import { TaskStatusEnum } from '@gauzy/contracts';
import type { IOrganizationProject, ITask } from '@gauzy/contracts';
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import {
	buildProjectManagementSnapshot,
	openTasksMostRecentFirst,
	projectManagementScopeKey,
	scopedId,
	sortProjectsByPopularity
} from './project-management-widget.utils';

/**
 * Builds a minimal widget context for the pure helpers under test.
 */
function createContext(overrides: Partial<IDashboardWidgetContext> = {}): IDashboardWidgetContext {
	return {
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		startDate: new Date('2026-07-20T00:00:00Z'),
		endDate: new Date('2026-07-26T23:59:59Z'),
		todayStart: new Date('2026-07-26T00:00:00Z'),
		todayEnd: new Date('2026-07-26T23:59:59Z'),
		timeZone: 'UTC',
		...overrides
	} as IDashboardWidgetContext;
}

/**
 * Builds a task carrying only the fields these helpers read.
 */
function createTask(id: string, status: TaskStatusEnum, projectId?: string): ITask {
	return {
		id,
		title: `task ${id}`,
		status,
		...(projectId ? { project: { id: projectId, name: `project ${projectId}` } as IOrganizationProject } : {})
	} as ITask;
}

describe('project management widget utils', () => {
	describe('projectManagementScopeKey', () => {
		it('returns an empty key for a missing context', () => {
			expect(projectManagementScopeKey(null)).toBe('');
		});

		it('ignores the reporting window', () => {
			// The task query is not filtered by the date picker, so moving the range
			// must NOT invalidate the cache or re-trigger a widget's fetch.
			const previous = createContext();
			const current = createContext({
				startDate: new Date('2020-01-01T00:00:00Z'),
				endDate: new Date('2020-01-31T23:59:59Z')
			});

			expect(projectManagementScopeKey(current)).toBe(projectManagementScopeKey(previous));
		});

		it('tolerates a bookmark-restored context whose dates are strings', () => {
			const serialized = createContext({
				startDate: '2026-07-20T00:00:00Z' as unknown as Date,
				endDate: '2026-07-26T23:59:59Z' as unknown as Date
			});

			expect(() => projectManagementScopeKey(serialized)).not.toThrow();
			expect(projectManagementScopeKey(serialized)).toBe(projectManagementScopeKey(createContext()));
		});

		it('separates employee and project scopes', () => {
			const ambient = projectManagementScopeKey(createContext());

			expect(projectManagementScopeKey(createContext({ employeeIds: ['emp-1'] }))).not.toBe(ambient);
			expect(projectManagementScopeKey(createContext({ projectIds: ['prj-1'] }))).not.toBe(ambient);
			expect(projectManagementScopeKey(createContext({ employeeIds: ['emp-1'] }))).not.toBe(
				projectManagementScopeKey(createContext({ employeeIds: ['emp-2'] }))
			);
		});
	});

	describe('scopedId', () => {
		it('returns null for an empty or missing scope', () => {
			expect(scopedId(undefined)).toBeNull();
			expect(scopedId([])).toBeNull();
		});

		it('narrows a multi-id scope to the first id the endpoint can express', () => {
			expect(scopedId(['emp-1', 'emp-2'])).toBe('emp-1');
		});
	});

	describe('sortProjectsByPopularity', () => {
		it('ranks projects by how many tasks belong to them', () => {
			const tasks = [
				createTask('1', TaskStatusEnum.OPEN, 'a'),
				createTask('2', TaskStatusEnum.OPEN, 'b'),
				createTask('3', TaskStatusEnum.OPEN, 'b'),
				createTask('4', TaskStatusEnum.OPEN, 'c'),
				createTask('5', TaskStatusEnum.OPEN, 'b')
			];

			expect(sortProjectsByPopularity(tasks).map((project) => project.id)).toEqual(['b', 'a', 'c']);
		});

		it('keeps first-seen order for equal counts', () => {
			const tasks = [createTask('1', TaskStatusEnum.OPEN, 'a'), createTask('2', TaskStatusEnum.OPEN, 'b')];

			expect(sortProjectsByPopularity(tasks).map((project) => project.id)).toEqual(['a', 'b']);
		});

		it('ignores tasks without a project', () => {
			const tasks = [createTask('1', TaskStatusEnum.OPEN), createTask('2', TaskStatusEnum.OPEN, 'a')];

			expect(sortProjectsByPopularity(tasks).map((project) => project.id)).toEqual(['a']);
		});
	});

	describe('openTasksMostRecentFirst', () => {
		it('keeps only open tasks, reversed', () => {
			const tasks = [
				createTask('1', TaskStatusEnum.OPEN),
				createTask('2', TaskStatusEnum.COMPLETED),
				createTask('3', TaskStatusEnum.OPEN)
			];

			expect(openTasksMostRecentFirst(tasks).map((task) => task.id)).toEqual(['3', '1']);
		});

		it('does not mutate the source list', () => {
			const tasks = [createTask('1', TaskStatusEnum.OPEN), createTask('2', TaskStatusEnum.OPEN)];

			openTasksMostRecentFirst(tasks);

			expect(tasks.map((task) => task.id)).toEqual(['1', '2']);
		});
	});

	describe('buildProjectManagementSnapshot', () => {
		it('projects one task page into the view each widget renders', () => {
			const tasks = [
				createTask('1', TaskStatusEnum.OPEN, 'a'),
				createTask('2', TaskStatusEnum.COMPLETED, 'a'),
				createTask('3', TaskStatusEnum.OPEN, 'b')
			];

			const snapshot = buildProjectManagementSnapshot(tasks, 42);

			expect(snapshot.tasks).toBe(tasks);
			expect(snapshot.total).toBe(42);
			expect(snapshot.projects.map((project) => project.id)).toEqual(['a', 'b']);
			expect(snapshot.assigned.map((task) => task.id)).toEqual(['3', '1']);
		});

		it('falls back to the page size when the server reports no usable total', () => {
			const tasks = [createTask('1', TaskStatusEnum.OPEN)];

			expect(buildProjectManagementSnapshot(tasks, Number.NaN).total).toBe(1);
			expect(buildProjectManagementSnapshot(tasks, undefined as unknown as number).total).toBe(1);
		});
	});
});
