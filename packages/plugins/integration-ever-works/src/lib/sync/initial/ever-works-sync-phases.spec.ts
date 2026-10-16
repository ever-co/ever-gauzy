/**
 * The pure parts of G-P1-10: phase order, parents-first import order, initial event ids (stable per
 * record version), the lag arithmetic and the conflict values.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(['IntegrationTenant', 'OrganizationProject', 'OrganizationTeam', 'Task', 'UserOrganization'].map((name) => [name, class {}])),
		TaskUpdateCommand: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null }
	};
});

import 'reflect-metadata';
import { behind } from '../admin/ever-works-sync-status.service';
import { clampLimit, conflictFromMerge, otherValue, parseBefore, parseDetails } from '../conflicts/ever-works-conflicts.service';
import { mergeField } from '../merge/three-way-merge';
import {
	depthsOf,
	EVER_WORKS_SYNC_PHASE_SPECS,
	EVER_WORKS_SYNC_PHASES,
	initialCommentEnvelope,
	initialEnvelope,
	initialSeq,
	orderForImport,
	resolvePass
} from './ever-works-sync-phases';

describe('initial sync phases', () => {
	it('follow plan 03 §C.6 step 3, each with one spec', () => {
		expect(EVER_WORKS_SYNC_PHASE_SPECS.map((spec) => spec.name)).toEqual([...EVER_WORKS_SYNC_PHASES]);
		expect(EVER_WORKS_SYNC_PHASES).toEqual(['members', 'agents', 'teams', 'works', 'missions', 'goals', 'ideas', 'tasks', 'task_edges', 'comments', 'inbox', 'docs']);
	});

	it('orders parents before their children, keeps list order within a depth, and cuts cycles', () => {
		const records = [
			{ id: 'c', parentTaskId: 'b' },
			{ id: 'b', parentTaskId: 'a' },
			{ id: 'a', parentTaskId: null },
			{ id: 'x', parentTaskId: 'not-listed' },
			{ id: 'loop1', parentTaskId: 'loop2' },
			{ id: 'loop2', parentTaskId: 'loop1' }
		];
		const depths = depthsOf(records, 'parentTaskId');
		expect(Object.fromEntries(depths)).toEqual({ a: 0, b: 1, c: 2, x: 0, loop1: 1, loop2: 1 });
		expect(orderForImport(records, 'parentTaskId').map(({ record }) => record.id)).toEqual(['a', 'x', 'b', 'loop1', 'loop2', 'c']);
	});

	it('never imports deleted or private records', () => {
		const ordered = orderForImport([{ id: 'a' }, { id: 'b', deleted: true }, { id: 'c', visibility: 'private' }, { id: 'd', visibility: 'team' }], undefined);
		expect(ordered.map(({ record }) => record['id'])).toEqual(['a', 'd']);
	});

	it('an initial event names the record and its version, so the same snapshot is stored once', () => {
		const input = { aggregateType: 'task', seq: initialSeq(1, 2), tenantId: 't', organizationId: 'o' };
		const first = initialEnvelope({ ...input, record: { id: 'task-1', version: 7, updatedAt: '2026-10-16T10:00:00.000Z' } });
		expect(first).toMatchObject({ id: 'initial:task:task-1:v7', type: 'task.updated', seq: '1000002', aggregate: { type: 'task', id: 'task-1', version: 7 }, origin: null });
		expect(initialEnvelope({ ...input, record: { id: 'task-1', version: 7 } }).id).toBe(first.id);
		expect(initialEnvelope({ ...input, record: { id: 'task-1', version: 8 } }).id).not.toBe(first.id);
		expect(initialEnvelope({ ...input, aggregateType: 'inbox_item', record: { id: 'i1', updatedAt: '2026-10-16T10:00:00.000Z' } }).type).toBe('inbox.item.created');
		expect(initialEnvelope({ ...input, record: { id: 'x'.repeat(80), version: 1 } }).id.length).toBeLessThanOrEqual(64);
		const comment = initialCommentEnvelope({ taskId: 'task-1', taskVersion: 7, comment: { id: 'c1', updatedAt: '2026-10-16T10:00:00.000Z' }, seq: '1000000000', tenantId: 't', organizationId: 'o' });
		expect(comment).toMatchObject({ type: 'task.comment.created', aggregate: { type: 'task', id: 'task-1', version: 7 }, data: { id: 'c1', taskId: 'task-1' } });
		expect(comment.id.startsWith('initial:comment:c1:t')).toBe(true);
	});

	it('resolves the "last 30 days" list pass', () => {
		const now = new Date('2026-10-31T00:00:00.000Z');
		expect(resolvePass({ updatedSince: '{{30d}}', status: 'open' }, now)).toEqual({ updatedSince: '2026-10-01T00:00:00.000Z', status: 'open' });
	});
});

describe('status and conflicts helpers', () => {
	it('lag: head − position, never negative, unknown when the head is', () => {
		expect(behind('120', '100')).toBe('20');
		expect(behind('100', '120')).toBe('0');
		expect(behind('18446744073709551615', '1')).toBe('18446744073709551614');
		expect(behind(null, '1')).toBeNull();
		expect(behind('5', null)).toBe('5');
	});

	it('a conflict carries both values in Gauzy terms and the winner; "use the other value" picks the loser', () => {
		const gauzyWins = mergeField({ kind: 'scalar' }, 'A', 'G', 'E', '2026-10-16T10:00:02Z', '2026-10-16T10:00:01Z');
		const details = conflictFromMerge('title', gauzyWins, { gauzyAt: '2026-10-16T10:00:02Z' });
		expect(details).toMatchObject({ field: 'title', gauzyValue: 'G', everWorksValue: 'E', winner: 'gauzy' });
		expect(otherValue({ ...(details as NonNullable<typeof details>) })).toBe('E');
		const everWorksWins = mergeField({ kind: 'scalar' }, 'A', 'G', 'E', null, null);
		const other = conflictFromMerge('status', everWorksWins, { gauzyField: 'taskStatus' });
		expect(other).toMatchObject({ gauzyField: 'taskStatus', gauzyValue: 'G', everWorksValue: 'E', winner: 'ever_works' });
		expect(otherValue(other as NonNullable<typeof other>)).toBe('G');
		expect(conflictFromMerge('title', mergeField({ kind: 'scalar' }, 'A', 'G', 'A'))).toBeNull();
	});

	it('reads only well-formed conflict details, page sizes and cursors', () => {
		expect(parseDetails('{"field":"name","winner":"gauzy","gauzyValue":1,"everWorksValue":2}')).toMatchObject({ field: 'name' });
		expect(parseDetails('{"field":"name","winner":"nobody"}')).toBeNull();
		expect(parseDetails('not json')).toBeNull();
		expect(clampLimit('500', 50, 200)).toBe(200);
		expect(clampLimit('0', 50, 200)).toBe(50);
		expect(clampLimit(undefined, 50, 200)).toBe(50);
		expect(parseBefore('2026-10-16T10:00:00Z')?.toISOString()).toBe('2026-10-16T10:00:00.000Z');
		expect(parseBefore('yesterday')).toBeNull();
	});
});
