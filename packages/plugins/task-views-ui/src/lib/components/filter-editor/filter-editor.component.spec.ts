import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ID, ITaskViewFilterGroup, ITaskViewInvalidFilter } from '@gauzy/contracts';
import { FilterEditorComponent, fieldKey, invalidKey, operatorKey } from './filter-editor.component';

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

	it('changes nothing while disabled', () => {
		fixture.componentRef.setInput('disabled', true);
		render(tree);
		expect(host().querySelector('[data-test="remove-condition"]')).toBeNull();
	});
});
