import { isTaskSyncAllowed, TaskSyncScopeEnum } from '@gauzy/contracts';

describe('isTaskSyncAllowed', () => {
	it('lets every integration sync a task without a scope (existing tasks)', () => {
		expect(isTaskSyncAllowed({}, 'third-party')).toBe(true);
		expect(isTaskSyncAllowed({ syncScope: null }, 'third-party')).toBe(true);
		expect(isTaskSyncAllowed({ syncScope: null }, 'ever-platform')).toBe(true);
	});

	it('lets every integration sync an `all` task', () => {
		expect(isTaskSyncAllowed({ syncScope: TaskSyncScopeEnum.ALL }, 'third-party')).toBe(true);
		expect(isTaskSyncAllowed({ syncScope: TaskSyncScopeEnum.ALL }, 'ever-platform')).toBe(true);
	});

	it('keeps an `ever-platform` task out of third-party integrations only', () => {
		expect(isTaskSyncAllowed({ syncScope: TaskSyncScopeEnum.EVER_PLATFORM }, 'third-party')).toBe(false);
		expect(isTaskSyncAllowed({ syncScope: TaskSyncScopeEnum.EVER_PLATFORM }, 'ever-platform')).toBe(true);
	});

	it('keeps a `none` task out of every integration', () => {
		expect(isTaskSyncAllowed({ syncScope: TaskSyncScopeEnum.NONE }, 'third-party')).toBe(false);
		expect(isTaskSyncAllowed({ syncScope: TaskSyncScopeEnum.NONE }, 'ever-platform')).toBe(false);
	});

	it('reads an unknown scope as `none`', () => {
		expect(isTaskSyncAllowed({ syncScope: 'partners-only' }, 'third-party')).toBe(false);
		expect(isTaskSyncAllowed({ syncScope: 'partners-only' }, 'ever-platform')).toBe(false);
	});
});
