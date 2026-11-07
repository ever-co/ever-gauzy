import { DataSource, EntitySchema } from 'typeorm';
import { applyTypeOrmReadPathPatches } from './typeorm-read-path.patches';

/**
 * The inverse side of a many-to-many under `relationLoadStrategy: 'query'` with Gauzy's TypeORM read-path patches
 * applied: `Task.teams` owns the join table, `Team.tasks` is the inverse side. On Gauzy's entities the inverse side
 * came back empty (`OrganizationTeam.tasks`, ever-co/ever-gauzy#11676) because both sides declare a `@JoinTable`
 * (see `organization-team.tasks-query-strategy.sqlite.spec.ts`); this checks that, on the smallest pair of entities
 * with one owner, the inverse side loads correctly with the patches applied — the patches are not what empties it.
 */
const Task = new EntitySchema<any>({
	name: 'Task',
	tableName: 'task',
	columns: {
		id: { type: 'varchar', primary: true },
		title: { type: 'varchar' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		teams: {
			type: 'many-to-many',
			target: 'Team',
			inverseSide: 'tasks',
			joinTable: { name: 'task_teams', joinColumn: { name: 'taskId' }, inverseJoinColumn: { name: 'teamId' } }
		}
	}
} as any);
const Team = new EntitySchema<any>({
	name: 'Team',
	tableName: 'team',
	columns: {
		id: { type: 'varchar', primary: true },
		name: { type: 'varchar' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: { tasks: { type: 'many-to-many', target: 'Task', inverseSide: 'teams' } }
} as any);

async function tasksOfTeams(): Promise<Record<string, string[]>> {
	const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [Task, Team], synchronize: true });
	await dataSource.initialize();
	try {
		await dataSource.query(`INSERT INTO team (id, name) VALUES ('team-1', 'Team 1'), ('team-2', 'Team 2')`);
		await dataSource.query(`INSERT INTO task (id, title) VALUES ('task-1', 'Task 1'), ('task-2', 'Task 2'), ('task-3', 'Task 3')`);
		await dataSource.query(
			`INSERT INTO task_teams (taskId, teamId) VALUES ('task-1', 'team-1'), ('task-2', 'team-1'), ('task-3', 'team-2')`
		);
		const teams: any[] = await dataSource
			.getRepository('Team')
			.find({ relations: { tasks: true }, relationLoadStrategy: 'query', order: { id: 'ASC' } });
		return Object.fromEntries(teams.map((team) => [team.id, team.tasks.map((task: any) => task.id).sort()]));
	} finally {
		await dataSource.destroy();
	}
}

describe('inverse many-to-many under relationLoadStrategy query', () => {
	const expected = { 'team-1': ['task-1', 'task-2'], 'team-2': ['task-3'] };

	it('loads the inverse side with the read-path patches applied', async () => {
		// `true`: applied now or already (TYPEORM_SKIP_REDUNDANT_RELATION_IDS=false would answer false and run unpatched)
		expect(applyTypeOrmReadPathPatches({ ...process.env, TYPEORM_SKIP_REDUNDANT_RELATION_IDS: undefined })).toBe(true);
		await expect(tasksOfTeams()).resolves.toEqual(expected);
	});
});
