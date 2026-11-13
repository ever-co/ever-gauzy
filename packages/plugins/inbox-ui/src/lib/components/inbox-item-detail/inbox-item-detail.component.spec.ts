import { TestBed } from '@angular/core/testing';
import { IInboxItemWithState, InboxItemKindEnum, InboxItemStatusEnum } from '@gauzy/contracts';
import { InboxItemDetailComponent } from './inbox-item-detail.component';

const question = (overrides: Partial<IInboxItemWithState> = {}): IInboxItemWithState =>
	({
		id: 'q1',
		kind: InboxItemKindEnum.QUESTION,
		source: 'GAUZY',
		status: InboxItemStatusEnum.OPEN,
		title: 'Which layout?',
		priority: 'normal',
		bodyFormat: 'plain',
		options: [
			{ id: 'a', label: 'Version A' },
			{ id: 'b', label: 'Version B' }
		],
		recipient: { isRead: true, isArchived: false, snoozedUntil: null },
		...overrides
	}) as IInboxItemWithState;

/** The reply composer: a suggested reply fills the reply box. */
describe('InboxItemDetailComponent', () => {
	function render(item: IInboxItemWithState = question()) {
		TestBed.configureTestingModule({ imports: [InboxItemDetailComponent] });
		const fixture = TestBed.createComponent(InboxItemDetailComponent);
		fixture.componentRef.setInput('item', item);
		fixture.detectChanges();
		return fixture.componentInstance;
	}

	it('a chosen option fills the reply box; another replaces its words; chosen again, it is dropped with them', () => {
		const component = render();
		const [a, b] = component.options();
		component.choose(a);
		expect(component.text()).toBe('Version A');
		component.choose(b);
		expect(component.optionId()).toBe('b');
		expect(component.text()).toBe('Version B');
		component.choose(b);
		expect(component.optionId()).toBeNull();
		expect(component.text()).toBe('');
	});

	it('never replaces a text the user wrote', () => {
		const component = render();
		component.text.set('My own answer');
		component.choose(component.options()[0]);
		expect(component.optionId()).toBe('a');
		expect(component.text()).toBe('My own answer');
	});

	it("sends the choice alone when the box holds its own words, and the edited text with it otherwise", () => {
		const component = render();
		const sent: unknown[] = [];
		component.replied.subscribe((reply) => sent.push(reply));
		component.choose(component.options()[0]);
		component.send();
		component.text.set('Version A, with the darker header');
		component.send();
		expect(sent).toEqual([{ optionId: 'a' }, { optionId: 'a', text: 'Version A, with the darker header' }]);
	});

	it("still asks for a reason when the box only repeats the option's words", () => {
		const component = render(question({ requireReason: true }));
		component.choose(component.options()[0]);
		expect(component.problem()).toBe('REASON_REQUIRED');
	});
});
