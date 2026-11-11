import { ID, ITaskViewFilterCondition, ITaskViewFilterGroup } from '@gauzy/contracts';
import {
	addCondition,
	addGroup,
	apiPathOf,
	applicableTree,
	canAdd,
	conditionsOf,
	countNodes,
	FILTER_MAX_DEPTH,
	FILTER_MAX_NODES,
	invalidByPath,
	isComplete,
	newCondition,
	nodeAt,
	operatorsOf,
	pathOfApi,
	removeNode,
	setGroupOp,
	treeOf,
	updateNode,
	withField,
	withOperator,
	withRelative,
	withValues,
	withoutInvalid
} from './filter-tree';

const A = '11111111-1111-4111-8111-111111111111' as ID;
const B = '22222222-2222-4222-8222-222222222222' as ID;
const C = '33333333-3333-4333-8333-333333333333' as ID;

const statusIn = (...values: ID[]): ITaskViewFilterCondition => ({ field: 'status', operator: 'in', values });
const labelsIn = (...values: ID[]): ITaskViewFilterCondition => ({ field: 'labels', operator: 'in', values });

describe('filter tree model', () => {
	describe('conditions', () => {
		it('starts a record field on "is any of" with nothing picked, a date field on this week', () => {
			expect(newCondition('priority')).toEqual({ field: 'priority', operator: 'in', values: [] });
			expect(newCondition('dueDate')).toEqual({
				field: 'dueDate',
				operator: 'relative',
				relative: { unit: 'week', direction: 'current' }
			});
		});

		it('offers the operators the platform takes for each kind of field', () => {
			expect(operatorsOf('labels')).toEqual(['in', 'notIn', 'isEmpty', 'isNotEmpty']);
			expect(operatorsOf('createdAt')).toEqual([
				'relative',
				'before',
				'after',
				'between',
				'isEmpty',
				'isNotEmpty'
			]);
		});

		it('starts over when the field changes (the ids named other records), and keeps it when it does not', () => {
			const condition = statusIn(A);
			expect(withField(condition, 'status')).toBe(condition);
			expect(withField(condition, 'labels')).toEqual({ field: 'labels', operator: 'in', values: [] });
			expect(withField(condition, 'dueDate').operator).toBe('relative');
		});

		it('keeps the ids between "is any of" and "is none of", and drops them for the empties', () => {
			expect(withOperator(statusIn(A, B), 'notIn')).toEqual({
				field: 'status',
				operator: 'notIn',
				values: [A, B]
			});
			expect(withOperator(statusIn(A), 'isEmpty')).toEqual({ field: 'status', operator: 'isEmpty' });
		});

		it('keeps the date bounds the new operator reads, and refuses an operator the field does not take', () => {
			const between: ITaskViewFilterCondition = {
				field: 'dueDate',
				operator: 'between',
				from: '2026-11-01T00:00:00.000Z',
				to: '2026-11-10T00:00:00.000Z'
			};
			expect(withOperator(between, 'after')).toEqual({ field: 'dueDate', operator: 'after', from: between.from });
			expect(withOperator(between, 'before')).toEqual({ field: 'dueDate', operator: 'before', to: between.to });
			expect(withOperator(statusIn(A), 'before')).toEqual(statusIn(A));
		});

		it('picks each id once, and bounds a relative amount to what the platform takes', () => {
			expect(withValues(statusIn(), [A, A, B]).values).toEqual([A, B]);
			const relative = newCondition('dueDate');
			expect(withRelative(relative, { unit: 'day', direction: 'past', amount: 999 }).relative).toEqual({
				unit: 'day',
				direction: 'past',
				amount: 366
			});
			expect(withRelative(relative, { unit: 'month', direction: 'current', amount: 4 }).relative).toEqual({
				unit: 'month',
				direction: 'current'
			});
		});

		it('says which conditions are complete enough to apply', () => {
			expect(isComplete(statusIn())).toBe(false);
			expect(isComplete(statusIn(A))).toBe(true);
			expect(isComplete({ field: 'dueDate', operator: 'between', from: 'x' })).toBe(false);
			expect(isComplete({ field: 'dueDate', operator: 'isEmpty' })).toBe(true);
		});
	});

	describe('editing the tree', () => {
		it('adds conditions and groups, making the root when there is none', () => {
			let tree = addCondition(null, [], statusIn(A));
			expect(tree).toEqual({ op: 'and', conditions: [statusIn(A)] });
			tree = addGroup(tree, [], 'or', labelsIn(B));
			tree = addCondition(tree, [1], labelsIn(C));
			expect(tree).toEqual({
				op: 'and',
				conditions: [statusIn(A), { op: 'or', conditions: [labelsIn(B), labelsIn(C)] }]
			});
			expect(nodeAt(tree, [1, 1])).toEqual(labelsIn(C));
			expect(nodeAt(tree, [3])).toBeNull();
		});

		it('never changes the tree it was given', () => {
			const tree: ITaskViewFilterGroup = { op: 'and', conditions: [statusIn(A)] };
			const frozen = JSON.stringify(tree);
			addCondition(tree, [], labelsIn(B));
			updateNode(tree, [0], () => labelsIn(B));
			removeNode(tree, [0]);
			setGroupOp(tree, [], 'or');
			expect(JSON.stringify(tree)).toBe(frozen);
		});

		it('replaces a node, and changes how a group joins', () => {
			const tree = addGroup(addCondition(null, [], statusIn(A)), [], 'or', labelsIn(B));
			expect(
				nodeAt(
					updateNode(tree, [1, 0], () => labelsIn(C)),
					[1, 0]
				)
			).toEqual(labelsIn(C));
			expect((nodeAt(setGroupOp(tree, [1], 'and'), [1]) as ITaskViewFilterGroup).op).toBe('and');
		});

		it('removes a node, a nested group it leaves empty, and the whole filter when the root is left empty', () => {
			const tree = addGroup(addCondition(null, [], statusIn(A)), [], 'or', labelsIn(B));
			expect(removeNode(tree, [1, 0])).toEqual({ op: 'and', conditions: [statusIn(A)] });
			expect(removeNode(removeNode(tree, [1, 0]), [0])).toBeNull();
			expect(removeNode(tree, [])).toBeNull();
		});

		it('keeps to the platform budget of nodes and depth', () => {
			let tree: ITaskViewFilterGroup | null = null;
			for (let index = 0; index < FILTER_MAX_NODES - 1; index += 1) tree = addCondition(tree, [], statusIn(A));
			expect(countNodes(tree)).toBe(FILTER_MAX_NODES);
			expect(canAdd(tree, 'condition')).toBe(false);
			const deep = Array.from({ length: FILTER_MAX_DEPTH - 1 }, () => 0);
			expect(canAdd(addCondition(null, [], statusIn(A)), 'group', deep)).toBe(true);
			expect(canAdd(addCondition(null, [], statusIn(A)), 'group', [...deep, 0])).toBe(false);
		});
	});

	describe('platform paths', () => {
		it('names a place as the platform does, and reads it back', () => {
			expect(apiPathOf([])).toBe('filter');
			expect(apiPathOf([0, 2])).toBe('filter.conditions.0.conditions.2');
			expect(pathOfApi('filter.conditions.0.conditions.2')).toEqual([0, 2]);
			expect(pathOfApi('filter')).toEqual([]);
			expect(pathOfApi('filter.items.1')).toBeNull();
			expect(pathOfApi('conditions.0')).toBeNull();
		});

		it('sends only what is complete, and maps each node sent back to its place in the editor', () => {
			const tree: ITaskViewFilterGroup = {
				op: 'and',
				conditions: [
					statusIn(),
					labelsIn(A),
					{ op: 'or', conditions: [statusIn(), statusIn(B)] },
					{ op: 'or', conditions: [labelsIn()] }
				]
			};
			const sent = applicableTree(tree);
			expect(sent.tree).toEqual({
				op: 'and',
				conditions: [labelsIn(A), { op: 'or', conditions: [statusIn(B)] }]
			});
			expect(sent.paths.get('filter.conditions.0')).toEqual([1]);
			expect(sent.paths.get('filter.conditions.1')).toEqual([2]);
			expect(sent.paths.get('filter.conditions.1.conditions.0')).toEqual([2, 1]);
			expect(applicableTree({ op: 'and', conditions: [statusIn()] }).tree).toBeNull();
		});

		it('places the invalid filters the platform reported on the conditions of the editor', () => {
			const tree: ITaskViewFilterGroup = { op: 'and', conditions: [statusIn(), labelsIn(A, B)] };
			const sent = applicableTree(tree);
			const byPath = invalidByPath(
				[{ path: 'filter.conditions.0', field: 'labels', reason: 'deleted-reference', values: [B] }],
				sent
			);
			expect([...byPath.keys()]).toEqual(['1']);
			// Without what was sent (a stored tree read as it is), the platform path is the editor path.
			expect([...invalidByPath([{ path: 'filter.conditions.0', reason: 'malformed' }], null).keys()]).toEqual([
				'0'
			]);
		});
	});

	describe('fixing invalid filters', () => {
		it('keeps the records that still exist and removes the condition when none does', () => {
			const tree: ITaskViewFilterGroup = { op: 'and', conditions: [labelsIn(A, B), statusIn(C)] };
			const fixed = withoutInvalid(
				tree,
				new Map([['0', [{ path: 'filter.conditions.0', reason: 'deleted-reference' as const, values: [B] }]]])
			);
			expect(fixed).toEqual({ op: 'and', conditions: [labelsIn(A), statusIn(C)] });
			const gone = withoutInvalid(
				tree,
				new Map([['1', [{ path: 'filter.conditions.1', reason: 'deleted-reference' as const, values: [C] }]]])
			);
			expect(gone).toEqual({ op: 'and', conditions: [labelsIn(A, B)] });
		});

		it('removes the other invalid conditions, later ones first, so no fix moves another', () => {
			const tree: ITaskViewFilterGroup = {
				op: 'and',
				conditions: [
					statusIn(A),
					{ op: 'or', conditions: [{ field: 'nope' as never, operator: 'in', values: [A] }, labelsIn(B)] },
					{ field: 'status', operator: 'between' }
				]
			};
			const invalid = new Map([
				['1.0', [{ path: 'filter.conditions.1.conditions.0', reason: 'unknown-field' as const }]],
				['2', [{ path: 'filter.conditions.2', reason: 'unknown-operator' as const }]]
			]);
			expect(withoutInvalid(tree, invalid)).toEqual({
				op: 'and',
				conditions: [statusIn(A), { op: 'or', conditions: [labelsIn(B)] }]
			});
		});
	});

	describe('reading a stored tree', () => {
		it('keeps the shape of a tree and nothing else', () => {
			expect(treeOf(null)).toBeNull();
			expect(treeOf({ op: 'and', conditions: [] })).toBeNull();
			expect(
				treeOf({ op: 'xor', conditions: [statusIn(A), 42, null, { op: 'or', conditions: [labelsIn(B)] }] })
			).toEqual({
				op: 'and',
				conditions: [statusIn(A), { op: 'or', conditions: [labelsIn(B)] }]
			});
		});

		it('walks the conditions in reading order with their paths', () => {
			const tree = addGroup(addCondition(null, [], statusIn(A)), [], 'or', labelsIn(B));
			expect(conditionsOf(tree).map((entry) => entry.path)).toEqual([[0], [1, 0]]);
		});
	});
});
