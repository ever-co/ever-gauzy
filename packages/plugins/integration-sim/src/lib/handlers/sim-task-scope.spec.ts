import { TaskSyncScopeEnum } from '@gauzy/contracts';
import { taskForSim, withTaskForSim } from './sim-task-scope';

describe('sim task scope', () => {
	const task = (syncScope?: TaskSyncScopeEnum | null) => ({ id: 't1', title: 'secret title', description: 'secret', syncScope });

	it('passes a task that third parties may sync unchanged', () => {
		expect(taskForSim(task())).toEqual(task());
		expect(taskForSim(task(TaskSyncScopeEnum.ALL))).toEqual(task(TaskSyncScopeEnum.ALL));
	});

	it('reduces a task private to the Ever platform, or kept out of every integration, to its id', () => {
		expect(taskForSim(task(TaskSyncScopeEnum.EVER_PLATFORM))).toEqual({ id: 't1' });
		expect(taskForSim(task(TaskSyncScopeEnum.NONE))).toEqual({ id: 't1' });
	});

	it('reduces a restricted parent or child inside an allowed task graph', () => {
		const graph = { ...task(), parent: task(TaskSyncScopeEnum.NONE), children: [task(TaskSyncScopeEnum.EVER_PLATFORM), task()] };
		expect(taskForSim(graph)).toEqual({ ...task(), parent: { id: 't1' }, children: [{ id: 't1' }, task()] });
	});

	it('reduces the task loaded on a time log and keeps the rest of the log', () => {
		const log = { id: 'l1', taskId: 't1', duration: 60, task: task(TaskSyncScopeEnum.EVER_PLATFORM) };
		expect(withTaskForSim(log)).toEqual({ id: 'l1', taskId: 't1', duration: 60, task: { id: 't1' } });
		expect(withTaskForSim({ id: 'l2', taskId: 't1' })).toEqual({ id: 'l2', taskId: 't1' });
		expect(withTaskForSim(null)).toBeNull();
	});
});
