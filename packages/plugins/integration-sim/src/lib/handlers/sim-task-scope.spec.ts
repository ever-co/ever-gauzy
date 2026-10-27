import { TaskSyncScopeEnum } from '@gauzy/contracts';
import { redactForSim } from './sim-task-scope';

describe('redactForSim', () => {
	const task = (id: string, syncScope?: TaskSyncScopeEnum | null) => ({ id, title: `title ${id}`, description: 'secret', syncScope });

	it('passes tasks third parties may sync unchanged', () => {
		expect(redactForSim(task('t1', null))).toEqual(task('t1', null));
		expect(redactForSim(task('t1', TaskSyncScopeEnum.ALL))).toEqual(task('t1', TaskSyncScopeEnum.ALL));
	});

	it('reduces a task private to the Ever platform, or kept out of every integration, to its id', () => {
		expect(redactForSim(task('t1', TaskSyncScopeEnum.EVER_PLATFORM))).toEqual({ id: 't1' });
		expect(redactForSim(task('t1', TaskSyncScopeEnum.NONE))).toEqual({ id: 't1' });
	});

	it('reduces restricted tasks anywhere in a timer payload', () => {
		const payload = {
			duration: 60,
			startedAt: new Date(0),
			lastLog: {
				id: 'l1',
				task: {
					...task('t1', null),
					parent: task('t2', TaskSyncScopeEnum.NONE),
					children: [task('t3', TaskSyncScopeEnum.EVER_PLATFORM), task('t4', null)],
					linkedIssues: [{ id: 'li1', taskFrom: task('t5', TaskSyncScopeEnum.NONE) }],
					project: { id: 'p1', name: 'Local', tasks: [task('t6', TaskSyncScopeEnum.EVER_PLATFORM)] }
				}
			},
			lastWorkedTask: task('t7', TaskSyncScopeEnum.NONE)
		};
		expect(redactForSim(payload)).toEqual({
			duration: 60,
			startedAt: new Date(0),
			lastLog: {
				id: 'l1',
				task: {
					...task('t1', null),
					parent: { id: 't2' },
					children: [{ id: 't3' }, task('t4', null)],
					linkedIssues: [{ id: 'li1', taskFrom: { id: 't5' } }],
					project: { id: 'p1', name: 'Local', tasks: [{ id: 't6' }] }
				}
			},
			lastWorkedTask: { id: 't7' }
		});
	});

	it('keeps a cycle without leaking the restricted task in it', () => {
		const restricted: Record<string, unknown> = task('t1', TaskSyncScopeEnum.NONE);
		const log: Record<string, unknown> = { id: 'l1', task: restricted };
		restricted['timeLogs'] = [log];
		const out = redactForSim({ a: log, b: restricted }) as { a: { task: unknown }; b: unknown };
		expect(out.b).toEqual({ id: 't1' });
		expect(out.a.task).toEqual({ id: 't1' });
	});

	it('leaves scalars and null alone', () => {
		expect(redactForSim(null)).toBeNull();
		expect(redactForSim(3)).toBe(3);
	});
});
