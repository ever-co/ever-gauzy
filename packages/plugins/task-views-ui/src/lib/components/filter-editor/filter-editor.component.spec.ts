import { ComponentFixture, TestBed } from '@angular/core/testing';
import { runInThisContext } from 'node:vm';
import { ID, ITaskViewFilterGroup, ITaskViewInvalidFilter } from '@gauzy/contracts';
import { FilterEditorComponent, fieldKey, invalidKey, operatorKey } from './filter-editor.component';

/**
 * Runs `body` with the clock in `zone`, as a browser there would be. Jest hands each test file a copy of
 * `process.env`, so setting `TZ` on it changes nothing: Node reads the host process's `env.TZ`.
 */
function inZone<T>(zone: string, body: () => T): T {
	const host = runInThisContext('process') as NodeJS.Process;
	const previous = host.env['TZ'];
	const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
	host.env['TZ'] = zone;
	try {
		return body();
	} finally {
		// Deleting `TZ` does not reset the clock's zone: set the one before first.
		host.env['TZ'] = previous ?? current;
		if (previous === undefined) delete host.env['TZ'];
	}
}

const LABEL = '11111111-1111-4111-8111-111111111111' as ID;
const GONE = '22222222-2222-4222-8222-222222222222' as ID;
const tree: ITaskViewFilterGroup = {
	op: 'and',
	conditions: [
		{ field: 'labels', operator: 'in', values: [LABEL, GONE] },
		{
			op: 'or',
			conditions: [
				{ field: 'dueDate', operator: 'relative', relative: { unit: 'week', direction: 'past', amount: 2 } }
			]
		}
	]
};

describe('FilterEditorComponent', () => {
	let fixture: ComponentFixture<FilterEditorComponent>;
	let changes: Array<ITaskViewFilterGroup | null>;
	const host = () => fixture.nativeElement as HTMLElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [FilterEditorComponent] }).compileComponents();
		fixture = TestBed.createComponent(FilterEditorComponent);
		changes = [];
		fixture.componentInstance.treeChange.subscribe((next) => changes.push(next));
	});

	function render(value: ITaskViewFilterGroup | null, invalid: Map<string, ITaskViewInvalidFilter[]> = new Map()) {
		fixture.componentRef.setInput('tree', value);
		fixture.componentRef.setInput('invalid', invalid);
		fixture.detectChanges();
	}

	it('names fields, operators and reasons by their i18n keys', () => {
		expect(fieldKey('dueDate')).toBe('TASK_VIEWS.FILTER.FIELDS.DUE_DATE');
		expect(operatorKey('isNotEmpty')).toBe('TASK_VIEWS.FILTER.OPERATORS.IS_NOT_EMPTY');
		expect(invalidKey('deleted-reference')).toBe('TASK_VIEWS.FILTER.INVALID.DELETED_REFERENCE');
	});

	it('offers a first filter when there is none', () => {
		render(null);
		expect(host().textContent).toContain('TASK_VIEWS.FILTER.NONE');
		(host().querySelector('[data-test="add-first-filter"]') as HTMLElement).click();
		expect(changes).toEqual([{ op: 'and', conditions: [{ field: 'status', operator: 'in', values: [] }] }]);
	});

	it('draws every condition of the tree, nested groups included', () => {
		render(tree);
		expect(host().querySelectorAll('[data-test="filter-condition"]').length).toBe(2);
		expect(host().querySelector('[data-path="1"]')?.classList.contains('nested')).toBe(true);
		expect(host().querySelector('input.amount')).toBeTruthy();
	});

	it('removes a condition, and a nested group with its last one', () => {
		render(tree);
		(host().querySelectorAll('[data-test="remove-condition"]')[1] as HTMLElement).click();
		expect(changes[0]).toEqual({ op: 'and', conditions: [tree.conditions[0]] });
	});

	it('shows an invalid filter on its condition and fixes it, keeping the records that still exist', () => {
		render(
			tree,
			new Map([
				['0', [{ path: 'filter.conditions.0', field: 'labels', reason: 'deleted-reference', values: [GONE] }]]
			])
		);
		const problem = host().querySelector('[data-test="invalid-filter"]') as HTMLElement;
		expect(problem.textContent).toContain('TASK_VIEWS.FILTER.INVALID.DELETED_REFERENCE');
		expect(host().querySelector('[data-path="0"]')?.classList.contains('invalid')).toBe(true);
		(host().querySelector('[data-test="fix-invalid"]') as HTMLElement).click();
		expect((changes[0]?.conditions[0] as { values: ID[] }).values).toEqual([LABEL]);
	});

	it('sends the day picked with its instant, for a reader in UTC−4 and one in UTC+2', () => {
		const between: ITaskViewFilterGroup = { op: 'and', conditions: [{ field: 'dueDate', operator: 'between' }] };
		const pick = (zone: string) =>
			inZone(zone, () => {
				changes = [];
				render(between);
				expect(new Date(2026, 10, 14).getTimezoneOffset()).toBe(zone === 'America/Caracas' ? 240 : -120);
				const dateField = (index: number) =>
					host().querySelectorAll('input[type="date"]')[index] as HTMLInputElement;
				dateField(0).value = '2026-11-14';
				dateField(0).dispatchEvent(new Event('change'));
				render(changes[0]);
				dateField(1).value = '2026-11-20';
				dateField(1).dispatchEvent(new Event('change'));
				return changes[1]?.conditions[0];
			});
		expect(pick('America/Caracas')).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-14T04:00:00.000Z',
			fromDay: '2026-11-14',
			to: '2026-11-21T03:59:59.999Z',
			toDay: '2026-11-20'
		});
		expect(pick('Africa/Johannesburg')).toEqual({
			field: 'dueDate',
			operator: 'between',
			from: '2026-11-13T22:00:00.000Z',
			fromDay: '2026-11-14',
			to: '2026-11-20T21:59:59.999Z',
			toDay: '2026-11-20'
		});
	});

	it('shows the day picked, not the reader’s day of its instant', () => {
		// "On or after 14 Nov" picked in UTC+2: 22:00 UTC on the 13th, which is the 13th for a reader in UTC−4.
		const after: ITaskViewFilterGroup = {
			op: 'and',
			conditions: [
				{ field: 'dueDate', operator: 'after', from: '2026-11-13T22:00:00.000Z', fromDay: '2026-11-14' }
			]
		};
		const shown = inZone('America/Caracas', () => {
			render(after);
			return (host().querySelector('input[type="date"]') as HTMLInputElement).value;
		});
		expect(shown).toBe('2026-11-14');
	});

	it('changes nothing while disabled', () => {
		fixture.componentRef.setInput('disabled', true);
		render(tree);
		expect(host().querySelector('[data-test="remove-condition"]')).toBeNull();
	});
});
