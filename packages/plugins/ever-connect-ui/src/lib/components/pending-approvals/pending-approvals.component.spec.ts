import { TestBed } from '@angular/core/testing';
import { EverConnectIntegration } from '../../services/ever-connect.service';
import { ApprovalDecision, PendingApprovalsComponent } from './pending-approvals.component';

const STATS_LINK: EverConnectIntegration = {
	key: 'stats_link',
	name: 'Link usage statistics to this organization',
	description: 'Connects the anonymous statistics identity of this installation to your organization.',
	direction: 'outbound',
	instance_wide: true,
	app_ever_co_only: false,
	scope_version: 1,
	scope: [
		{
			field_path: 'instance.stats_instance_id',
			direction: 'to_ever',
			form: 'id',
			frequency: 'once',
			purpose: 'Link the statistics',
			retention: 'While enabled'
		}
	],
	revoke_effect: 'The link is cleared.',
	state: 'pending_operator',
	enabled: false,
	pending_remote_revoke: false,
	revoke_source: null,
	revoked_at: null,
	consent: { id: '01JD4M2N3P4Q5R6S7T8V9V0W1X', at: null, source: 'app_ever_co' },
	policy: 'allowed'
};

/**
 * The operator's approval list: who asked, what would start moving, and Accept or Decline behind a
 * confirmation; each sends the decision once.
 */
describe('PendingApprovalsComponent', () => {
	function render(items: EverConnectIntegration[]) {
		TestBed.configureTestingModule({ imports: [PendingApprovalsComponent] });
		const fixture = TestBed.createComponent(PendingApprovalsComponent);
		fixture.componentRef.setInput('items', items);
		fixture.componentRef.setInput('handle', 'acme');
		const decisions: ApprovalDecision[] = [];
		fixture.componentInstance.decide.subscribe((decision) => decisions.push(decision));
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const find = (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null;
		const click = (test: string) => {
			find(test)?.click();
			fixture.detectChanges();
		};
		return { el, find, click, decisions };
	}

	it('lists nothing when nothing waits', () => {
		const { find } = render([]);
		expect(find('pending-approvals')).toBeNull();
	});

	it('shows who asked; Accept lists what starts moving, then sends accepted: true once', () => {
		const { find, click, decisions, el } = render([STATS_LINK]);
		expect(find('approval-stats_link')?.textContent).toContain('EVER_CONNECT.APPROVALS.REQUESTED_BY');
		click('accept');
		expect(find('confirmation')?.textContent).toContain('instance.stats_instance_id');
		expect(decisions).toEqual([]);
		click('confirm');
		expect(decisions).toEqual([{ key: 'stats_link', accepted: true }]);
		expect(el.querySelector('[data-test="confirmation"]')).toBeNull();
	});

	it('Decline sends accepted: false; Cancel sends nothing', () => {
		const { click, decisions } = render([STATS_LINK]);
		click('decline');
		click('cancel');
		expect(decisions).toEqual([]);
		click('decline');
		click('confirm');
		expect(decisions).toEqual([{ key: 'stats_link', accepted: false }]);
	});
});
