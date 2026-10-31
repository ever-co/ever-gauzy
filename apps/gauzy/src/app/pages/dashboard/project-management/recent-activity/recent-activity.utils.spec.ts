import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum, IActivityLog } from '@gauzy/contracts';
import {
	humanizeEntity,
	mergeRecentActivity,
	relativeTime,
	toRecentActivityItem,
	withRelativeTimes
} from './recent-activity.utils';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const KEY = 'DASHBOARD_PAGE.PROJECT_MANAGEMENT_VIEW.RECENT_ACTIVITY';

const log = (extra: Partial<IActivityLog>): IActivityLog =>
	({
		id: 'log-1',
		entity: BaseEntityEnum.Task,
		entityId: 'task-1',
		action: ActionTypeEnum.Created,
		actorType: ActorTypeEnum.User,
		createdAt: new Date('2026-10-31T11:55:00.000Z'),
		...extra
	}) as IActivityLog;

describe('toRecentActivityItem', () => {
	it('names a task created by an employee, links it to its page and tells when', () => {
		const item = toRecentActivityItem(
			log({
				data: { title: 'Fix the login page' },
				employee: { user: { firstName: 'Ada', lastName: 'Lovelace' } } as IActivityLog['employee']
			}),
			NOW
		);

		expect(item).toMatchObject({
			id: 'log-1',
			title: 'Fix the login page',
			entityLabelKey: `${KEY}.ENTITY.TASK`,
			summaryKey: `${KEY}.CREATED_BY`,
			actorName: 'Ada Lovelace',
			actorKey: null,
			link: ['/pages/tasks/view', 'task-1'],
			tone: 'created',
			icon: 'plus-outline',
			when: '5 minutes ago'
		});
	});

	it('links a project to its own page, and lists the fields an update changed', () => {
		const item = toRecentActivityItem(
			log({
				entity: BaseEntityEnum.OrganizationProject,
				entityId: 'project-1',
				action: ActionTypeEnum.Updated,
				data: { name: 'Gauzy' },
				updatedFields: ['name', 'color'],
				employee: { fullName: 'Grace Hopper' } as IActivityLog['employee']
			}),
			NOW
		);

		expect(item.link).toEqual(['/pages/organization/projects/view', 'project-1']);
		expect(item.entityLabelKey).toBe(`${KEY}.ENTITY.PROJECT`);
		expect(item.summaryKey).toBe(`${KEY}.UPDATED_BY`);
		expect(item.changedFields).toEqual(['name', 'color']);
		expect(item.title).toBe('Gauzy');
		expect(item.tone).toBe('updated');
	});

	it('gives a deleted record no link: it has no page left', () => {
		const item = toRecentActivityItem(log({ action: ActionTypeEnum.Deleted, data: { title: 'Old task' } }), NOW);

		expect(item.link).toBeNull();
		expect(item.tone).toBe('deleted');
	});

	it('attributes a system change to the system, and a change with no author to no one', () => {
		const system = toRecentActivityItem(log({ actorType: ActorTypeEnum.System }), NOW);
		const nobody = toRecentActivityItem(log({}), NOW);

		expect(system.actorKey).toBe(`${KEY}.SYSTEM`);
		expect(system.summaryKey).toBe(`${KEY}.CREATED_BY`);
		expect(nobody.actorName).toBe('');
		expect(nobody.summaryKey).toBe(`${KEY}.CREATED`);
	});

	it('reads the json columns SQLite returns as strings', () => {
		const item = toRecentActivityItem(
			log({
				action: ActionTypeEnum.Updated,
				data: JSON.stringify({ title: 'From SQLite' }) as unknown as IActivityLog['data'],
				updatedFields: JSON.stringify(['status']) as unknown as string[]
			}),
			NOW
		);

		expect(item.title).toBe('From SQLite');
		expect(item.changedFields).toEqual(['status']);
	});

	it('falls back to the quoted name in the description, and tolerates broken json', () => {
		const item = toRecentActivityItem(
			log({
				data: '{broken' as unknown as IActivityLog['data'],
				updatedFields: '{}' as unknown as string[],
				description: 'Created a new Task called "From the description"'
			}),
			NOW
		);

		expect(item.title).toBe('From the description');
		expect(item.changedFields).toEqual([]);
	});

	it('names a kind without a word of its own from its type, and shows an unknown action as it is', () => {
		const item = toRecentActivityItem(
			log({ entity: BaseEntityEnum.OrganizationVendor, action: 'Archived' as ActionTypeEnum }),
			NOW
		);

		expect(item.entityLabelKey).toBeNull();
		expect(item.entityLabel).toBe('Organization vendor');
		expect(item.summaryKey).toBeNull();
		expect(item.action).toBe('Archived');
		expect(item.tone).toBe('other');
		expect(item.link).toBeNull();
	});
});

describe('humanizeEntity', () => {
	it('splits a type name into words', () => {
		expect(humanizeEntity('OrganizationProjectModule')).toBe('Organization project module');
		expect(humanizeEntity('Task')).toBe('Task');
		expect(humanizeEntity('')).toBe('');
	});
});

describe('mergeRecentActivity', () => {
	it('appends a page without the rows already shown', () => {
		const a = toRecentActivityItem(log({ id: 'a' }), NOW);
		const b = toRecentActivityItem(log({ id: 'b' }), NOW);
		const c = toRecentActivityItem(log({ id: 'c' }), NOW);

		expect(mergeRecentActivity([a, b], [b, c]).map((item) => item.id)).toEqual(['a', 'b', 'c']);
	});
});

describe('withRelativeTimes', () => {
	const now = new Date('2026-10-31T12:00:00.000Z');
	const item = (id: string, createdAt: string) =>
		toRecentActivityItem({ id, createdAt } as unknown as IActivityLog, now);

	it('tells each row its age again from a later moment', () => {
		const rows = [item('a', '2026-10-31T11:59:50.000Z'), item('b', '2026-10-30T12:00:00.000Z')];
		expect(rows.map((row) => row.when)).toEqual(['now', 'yesterday']);

		const later = withRelativeTimes(rows, new Date('2026-10-31T13:00:00.000Z'));

		expect(later.map((row) => row.when)).toEqual(['1 hour ago', 'yesterday']);
		expect(later[1]).toBe(rows[1]);
	});

	it('keeps the list itself when no age reads differently', () => {
		const rows = [item('a', '2026-10-30T12:00:00.000Z')];

		expect(withRelativeTimes(rows, new Date('2026-10-31T12:05:00.000Z'))).toBe(rows);
	});

	it('says nothing for a row without a time', () => {
		expect(relativeTime(undefined, now)).toBe('');
		expect(relativeTime('not a date', now)).toBe('');
	});

	it('tells ages in the language asked for, with the same thresholds as before', () => {
		const ago = (seconds: number, language?: string) =>
			relativeTime(new Date(now.getTime() - seconds * 1000), now, language);

		expect([ago(44), ago(45), ago(90), ago(44 * 60), ago(3 * 3600), ago(2 * 86400), ago(400 * 86400)]).toEqual([
			'now',
			'1 minute ago',
			'2 minutes ago',
			'44 minutes ago',
			'3 hours ago',
			'2 days ago',
			'last year'
		]);
		expect(ago(5 * 60, 'zh')).toBe('5分钟前');
		expect(ago(-30)).toBe('now');
		// A language the browser has no wording for falls back to one it has, with the number still told.
		expect(ago(5 * 60, 'ach')).toContain('5');
	});

	it('tells the rows again in another language', () => {
		const rows = [item('a', '2026-10-30T12:00:00.000Z')];

		expect(withRelativeTimes(rows, now, 'fr').map((row) => row.when)).toEqual(['hier']);
	});
});
