import { TestBed } from '@angular/core/testing';
import {
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { blankDraft, ITaskAutomationDraft } from '../task-automations-ui.helpers';
import { TaskAutomationEditorComponent, withNamed } from './automation-editor.component';

/** The rule editor. */
describe('TaskAutomationEditorComponent', () => {
	function render(draft: ITaskAutomationDraft = { ...blankDraft(), name: 'Rule' }) {
		TestBed.configureTestingModule({ imports: [TaskAutomationEditorComponent] });
		const fixture = TestBed.createComponent(TaskAutomationEditorComponent);
		fixture.componentRef.setInput('value', draft);
		fixture.componentRef.setInput('directory', {
			statuses: [{ value: 'done', label: 'Done' }],
			priorities: [{ value: 'high', label: 'High' }],
			tags: [{ value: 'tag-1', label: 'Review' }],
			employees: [{ value: 'e-1', label: 'Ada' }],
			projects: [],
			teams: []
		});
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const saved: ITaskAutomationDraft[] = [];
		fixture.componentInstance.save.subscribe((value) => saved.push(value));
		return {
			fixture,
			component: fixture.componentInstance,
			saved,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null
		};
	}

	it('edits a copy of the draft it is given', () => {
		const draft = { ...blankDraft(), name: 'Rule' };
		const { component } = render(draft);
		component.patch({ name: 'Changed' });
		expect(draft.name).toBe('Rule');
		expect(component.draft().name).toBe('Changed');
	});

	it('locks the form while the page saves; Cancel stays', () => {
		const { fixture, find } = render();
		fixture.componentRef.setInput('saving', true);
		fixture.detectChanges();
		const lock = (fixture.nativeElement as HTMLElement).querySelector('fieldset.form-lock') as HTMLFieldSetElement;
		expect(lock.disabled).toBe(true);
		expect(lock.contains(find('name'))).toBe(true);
		expect(lock.contains(find('cancel'))).toBe(false);
		fixture.componentRef.setInput('saving', false);
		fixture.detectChanges();
		expect(lock.disabled).toBe(false);
	});

	it('shows the status lists only for a status change', () => {
		const { component, find, fixture } = render();
		expect(find('to-statuses')).not.toBeNull();
		component.setTrigger(TaskAutomationTriggerEnum.DUE_DATE_PASSED);
		fixture.detectChanges();
		expect(find('to-statuses')).toBeNull();
	});

	it('offers “merged only” for a closed link alone, and saves what the box says', () => {
		const { component, find, fixture, saved } = render();
		expect(find('merged-only')).toBeNull();
		component.setTrigger(TaskAutomationTriggerEnum.LINK_CLOSED);
		fixture.detectChanges();
		expect(find('merged-only')).not.toBeNull();
		expect(find('merged-only')?.querySelector('input[type="checkbox"]')).not.toBeNull();
		expect(component.draft().trigger.mergedOnly).toBe(false);

		component.patchTrigger({ mergedOnly: true });
		fixture.detectChanges();
		expect((find('merged-only')?.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
		component.submit();
		expect(saved[0].trigger).toMatchObject({ type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true });

		component.setTrigger(TaskAutomationTriggerEnum.TASK_CREATED);
		fixture.detectChanges();
		expect(find('merged-only')).toBeNull();
	});

	it('adds conditions and actions; a new type starts the line over; the last action stays', () => {
		const { component, find, fixture } = render();
		component.addCondition();
		component.setConditionType(0, TaskAutomationConditionEnum.HAS_LABEL);
		component.patchCondition(0, { values: ['tag-1'] });
		component.setConditionType(0, TaskAutomationConditionEnum.TITLE_CONTAINS);
		fixture.detectChanges();
		expect(component.draft().conditions[0]).toEqual({ type: TaskAutomationConditionEnum.TITLE_CONTAINS, values: [], text: '' });
		expect(find('condition-text-0')).not.toBeNull();

		component.removeAction(0);
		expect(component.draft().actions).toHaveLength(1);
		component.addAction();
		expect(component.draft().actions[1].type).toBe(TaskAutomationActionEnum.NOTIFY_ASSIGNEES);
		component.removeAction(0);
		expect(component.draft().actions.map((action) => action.type)).toEqual([TaskAutomationActionEnum.NOTIFY_ASSIGNEES]);
	});

	it('sets a status by category or by name through one picker', () => {
		const { component } = render();
		component.setActionStatus(0, 'status:done');
		expect(component.draft().actions[0]).toMatchObject({ statusMode: 'status', status: 'done' });
		expect(component.statusChoiceOf(component.draft().actions[0])).toBe('status:done');
		component.setActionStatus(0, `category:${TaskAutomationStatusCategoryEnum.TODO}`);
		expect(component.draft().actions[0]).toMatchObject({ statusMode: 'category', status: '', category: TaskAutomationStatusCategoryEnum.TODO });
	});

	it('shows what keeps it from saving, and hands a valid draft to the page', () => {
		const { component, find, fixture, saved } = render({ ...blankDraft(), name: '' });
		expect(find('form-errors')).toBeNull();
		component.submit();
		fixture.detectChanges();
		expect(saved).toEqual([]);
		expect(find('form-errors')?.textContent).toContain('TASK_AUTOMATIONS.ERRORS.NAME_REQUIRED');
		component.patch({ name: 'Named' });
		component.submit();
		expect(saved).toHaveLength(1);
		expect(saved[0].name).toBe('Named');
	});

	it('tells the page the scope it is narrowed to', () => {
		const { component } = render();
		const scopes: unknown[] = [];
		component.scopeChange.subscribe((scope) => scopes.push(scope));
		component.patchScope({ projectId: 'project-1' });
		expect(scopes).toEqual([{ projectId: 'project-1', organizationTeamId: null }]);
		expect(component.draft().projectId).toBe('project-1');
	});

	it('keeps the values a rule names that the lists do not hold', () => {
		expect(withNamed([{ value: 'a', label: 'A' }], ['a', 'b', ''])).toEqual([
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'b' }
		]);
	});
});
