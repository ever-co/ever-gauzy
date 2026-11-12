import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ID, TaskStatusEnum } from '@gauzy/contracts';
import { EMPTY_OPTIONS, TaskViewOptions } from '../../services/task-views-options.service';
import { BulkApply, BulkToolbarComponent, filterOptions } from './bulk-toolbar.component';

const options: TaskViewOptions = {
	...EMPTY_OPTIONS,
	status: [
		{ id: 's1' as ID, label: 'in progress', value: 'in-progress' },
		{ id: 's2' as ID, label: 'Waiting on client', value: 'waiting-on-client' }
	],
	labels: [
		{ id: 't1' as ID, label: 'Bug', color: '#f00' },
		{ id: 't2' as ID, label: 'Backend' }
	],
	project: [{ id: 'p1' as ID, label: 'API' }]
};

describe('BulkToolbarComponent', () => {
	let fixture: ComponentFixture<BulkToolbarComponent>;
	let applied: BulkApply[];
	const host = () => fixture.nativeElement as HTMLElement;
	const click = (selector: string) => {
		(host().querySelector(selector) as HTMLElement).click();
		fixture.detectChanges();
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [BulkToolbarComponent] }).compileComponents();
		fixture = TestBed.createComponent(BulkToolbarComponent);
		fixture.componentRef.setInput('count', 3);
		fixture.componentRef.setInput('options', options);
		applied = [];
		fixture.componentInstance.applied.subscribe((change) => applied.push(change));
		fixture.detectChanges();
	});

	it('says how many are selected, and when the selection is full', () => {
		expect(host().querySelector('[data-test="bulk-count"]')?.textContent).toContain('TASK_VIEWS.BULK.SELECTED');
		expect(host().textContent).not.toContain('TASK_VIEWS.BULK.LIMIT');
		fixture.componentRef.setInput('count', 100);
		fixture.detectChanges();
		expect(host().textContent).toContain('TASK_VIEWS.BULK.LIMIT');
	});

	it('opens a picker with its search, and a status picked is the platform changes', () => {
		click('[data-picker="status"]');
		const panel = host().querySelector('[data-test="bulk-panel"]') as HTMLElement;
		expect(panel).toBeTruthy();
		expect(panel.querySelector('input[type="search"]')).toBeTruthy();
		expect(panel.querySelectorAll('[data-option]').length).toBe(2);
		click('[data-option="s1"]');
		expect(applied).toEqual([
			{ action: 'status', changes: { taskStatusId: 's1', status: TaskStatusEnum.IN_PROGRESS } }
		]);
		expect(host().querySelector('[data-test="bulk-panel"]')).toBeNull();
	});

	it('picks the first match on Enter in the search only; Enter on an option is that option', () => {
		click('[data-picker="status"]');
		const panel = () => host().querySelector('[data-test="bulk-panel"]') as HTMLElement;
		const second = panel().querySelector('[data-option="s2"]') as HTMLElement;
		second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		expect(applied).toEqual([]);
		const search = panel().querySelector('input[type="search"]') as HTMLInputElement;
		search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		expect(applied).toEqual([
			{ action: 'status', changes: { taskStatusId: 's1', status: TaskStatusEnum.IN_PROGRESS } }
		]);
	});

	it('leaves Enter and Escape to text an input method is composing in the search', () => {
		click('[data-picker="status"]');
		const search = () =>
			host().querySelector('[data-test="bulk-panel"] input[type="search"]') as HTMLInputElement | null;
		const composing = (key: string) =>
			new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true, cancelable: true });
		search()?.dispatchEvent(composing('Enter'));
		search()?.dispatchEvent(composing('Escape'));
		fixture.detectChanges();
		expect(applied).toEqual([]);
		expect(fixture.componentInstance.isPickerOpen).toBe(true);
		// Safari marks the Enter that ends a composition by its key code alone.
		const legacy = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		Object.defineProperty(legacy, 'keyCode', { value: 229 });
		search()?.dispatchEvent(legacy);
		expect(applied).toEqual([]);
	});

	it('adds or removes a label', () => {
		fixture.componentInstance.openPicker('labels');
		fixture.detectChanges();
		click('[data-option="t1"]');
		fixture.componentInstance.openPicker('labels');
		fixture.detectChanges();
		const remove = host().querySelectorAll('.mode button')[1] as HTMLElement;
		expect(remove.getAttribute('aria-pressed')).toBe('false');
		remove.click();
		fixture.detectChanges();
		click('[data-option="t2"]');
		expect(applied).toEqual([
			{ action: 'labels', changes: { addTagIds: ['t1'] } },
			{ action: 'labels', changes: { removeTagIds: ['t2'] } }
		]);
	});

	it('moves to no project, archives, and asks the page to delete', () => {
		const deleted = jest.fn();
		fixture.componentInstance.deleted.subscribe(deleted);
		fixture.componentInstance.openPicker('project');
		fixture.detectChanges();
		click('.choice.muted');
		click('[data-test="bulk-archive"]');
		click('[data-test="bulk-delete"]');
		expect(applied).toEqual([
			{ action: 'project', changes: { projectId: null } },
			{ action: 'archive', changes: { isArchived: true } }
		]);
		expect(deleted).toHaveBeenCalled();
	});

	it('clears the due date', () => {
		fixture.componentInstance.openPicker('dueDate');
		fixture.detectChanges();
		expect(host().querySelector('input[type="date"]')).toBeTruthy();
		click('.due button[ghost]');
		expect(applied).toEqual([{ action: 'dueDate', changes: { dueDate: null } }]);
	});

	it('opens nothing while busy or without the edit permission, and the same picker again closes it', () => {
		fixture.componentInstance.openPicker('status');
		fixture.componentInstance.openPicker('status');
		expect(fixture.componentInstance.isPickerOpen).toBe(false);
		fixture.componentRef.setInput('busy', true);
		fixture.componentInstance.openPicker('status');
		expect(fixture.componentInstance.isPickerOpen).toBe(false);
	});

	it('finds options by every word of the search', () => {
		expect(filterOptions(options.status, 'on CLIENT').map((option) => option.id)).toEqual(['s2']);
		expect(filterOptions(options.status, '  ')).toHaveLength(2);
	});
});
