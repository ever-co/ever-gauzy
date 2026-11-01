import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { EverWorksInboxPreferencesView } from '../../services/ever-works.service';
import { EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksInboxPreferencesComponent } from './ever-works-inbox-preferences.component';

const VIEW: EverWorksInboxPreferencesView = {
	available: ['notice', 'question', 'approval', 'mention', 'assignment', 'email', 'other'],
	kinds: { notice: true, question: true, approval: true, mention: true, assignment: true, email: true, other: false },
	updatedAt: '2026-10-28T10:00:00.000Z',
	organizations: [
		{ organizationId: 'org-1', organizationName: 'Acme', paired: true, sending: true, reason: null },
		{ organizationId: 'org-2', organizationName: 'Globex', paired: false, sending: false, reason: 'not_paired' },
		{ organizationId: 'org-3', organizationName: null, paired: true, sending: false, reason: 'some_new_reason' }
	]
};

/** Settings → Ever Works inbox: my kinds, saved as changed; where my items go, and why not. */
describe('EverWorksInboxPreferencesComponent', () => {
	const api = { inboxPreferences: jest.fn(), updateInboxPreferences: jest.fn() };

	async function render() {
		TestBed.configureTestingModule({
			imports: [EverWorksInboxPreferencesComponent],
			providers: [{ provide: EverWorksUiService, useValue: api }]
		});
		const fixture = TestBed.createComponent(EverWorksInboxPreferencesComponent);
		fixture.detectChanges();
		// `ngModel` writes the switches' values after a microtask.
		await fixture.whenStable();
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			fixture,
			component: fixture.componentInstance,
			el,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`),
			toggle: (kind: string) => el.querySelector(`[data-test="toggle-${kind}"] input`) as HTMLInputElement
		};
	}

	beforeEach(() => jest.resetAllMocks());

	it('lists every kind in the API order with its description, switched as saved', async () => {
		api.inboxPreferences.mockReturnValue(of(VIEW));
		const { el, find, toggle } = await render();
		const kinds = Array.from(el.querySelectorAll('[data-test="kinds"] > li')).map((li) =>
			li.getAttribute('data-test')
		);
		expect(kinds).toEqual([
			'kind-notice',
			'kind-question',
			'kind-approval',
			'kind-mention',
			'kind-assignment',
			'kind-email',
			'kind-other'
		]);
		expect(find('kind-email')?.textContent).toContain('EVER_WORKS.INBOX_KINDS.email.LABEL');
		expect(find('kind-email')?.textContent).toContain('EVER_WORKS.INBOX_KINDS.email.HINT');
		expect(toggle('email').checked).toBe(true);
		expect(toggle('other').checked).toBe(false);
		// Nothing changed yet: nothing to save.
		expect((find('save') as HTMLButtonElement).disabled).toBe(true);
		expect(find('defaults')).toBeNull();
	});

	it('saves only the kinds that changed, and shows the page as saved', async () => {
		api.inboxPreferences.mockReturnValue(of(VIEW));
		const saved = { ...VIEW, kinds: { ...VIEW.kinds, email: false, other: true } };
		api.updateInboxPreferences.mockReturnValue(of(saved));
		const { fixture, component, find, toggle } = await render();
		toggle('email').click();
		toggle('other').click();
		fixture.detectChanges();
		expect(component.kinds['email']).toBe(false);
		(find('save') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.updateInboxPreferences).toHaveBeenCalledWith({ email: false, other: true });
		expect(find('saved')).not.toBeNull();
		expect(component.hasChanges()).toBe(false);
		// Switching one back after the save is a change again: the notice goes.
		toggle('email').click();
		fixture.detectChanges();
		expect(find('saved')).toBeNull();
		expect(component.hasChanges()).toBe(true);
	});

	it('shows the API refusal of a save and keeps the switches', async () => {
		api.inboxPreferences.mockReturnValue(of(VIEW));
		api.updateInboxPreferences.mockReturnValue(
			throwError(() => ({ status: 400, error: { message: ['kinds.bogus is not a kind'] } }))
		);
		const { fixture, component, find, toggle } = await render();
		toggle('notice').click();
		component.save();
		fixture.detectChanges();
		expect(find('save-error')?.textContent).toContain('kinds.bogus is not a kind');
		expect(component.kinds['notice']).toBe(false);
		expect(component.busy).toBe(false);
	});

	it('shows per organization whether my items are sent, and why not (a reason it does not know, as it is)', async () => {
		api.inboxPreferences.mockReturnValue(of(VIEW));
		const { find } = await render();
		expect(find('sending-org-1')).not.toBeNull();
		expect(find('organization-org-1')?.textContent).toContain('Acme');
		expect(find('not-sending-org-2')).not.toBeNull();
		expect(find('reason-org-2')?.textContent).toContain('EVER_WORKS.INBOX_PREFERENCES.REASONS.not_paired');
		// No name: its id.
		expect(find('organization-org-3')?.textContent).toContain('org-3');
		expect(find('reason-org-3')?.textContent).toContain('some_new_reason');
	});

	it('never saved: every kind on, and says so; no organization mapped: says nothing is sent', async () => {
		api.inboxPreferences.mockReturnValue(
			of({
				...VIEW,
				kinds: {
					notice: true,
					question: true,
					approval: true,
					mention: true,
					assignment: true,
					email: true,
					other: true
				},
				updatedAt: null,
				organizations: []
			})
		);
		const { find } = await render();
		expect(find('defaults')).not.toBeNull();
		expect(find('no-organizations')).not.toBeNull();
		expect(find('organizations')).toBeNull();
		expect(find('nothing-sent')).toBeNull();
	});

	it('every kind saved off: says nothing of mine is sent', async () => {
		api.inboxPreferences.mockReturnValue(
			of({
				...VIEW,
				kinds: {
					notice: false,
					question: false,
					approval: false,
					mention: false,
					assignment: false,
					email: false,
					other: false
				},
				updatedAt: '2026-11-01T10:00:00.000Z'
			})
		);
		const { find } = await render();
		expect(find('nothing-sent')?.textContent).toContain('EVER_WORKS.INBOX_PREFERENCES.NOTHING_SENT');
		expect(find('defaults')).toBeNull();
	});

	it('404 (the Ever Works plugin is off): says the integration is not switched on, nothing else', async () => {
		api.inboxPreferences.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = await render();
		expect(component.view).toBe('unavailable');
		expect(find('unavailable')?.textContent).toContain('EVER_WORKS.INBOX_PREFERENCES.UNAVAILABLE');
		expect(find('kinds')).toBeNull();
		expect(find('retry')).toBeNull();
	});

	it('another failure offers a retry, which reads the page again', async () => {
		api.inboxPreferences
			.mockReturnValueOnce(throwError(() => ({ status: 503, error: { message: 'Service Unavailable' } })))
			.mockReturnValue(of(VIEW));
		const { fixture, component, find } = await render();
		expect(component.view).toBe('error');
		expect(find('error')?.textContent).toContain('Service Unavailable');
		(find('retry') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.inboxPreferences).toHaveBeenCalledTimes(2);
		expect(component.view).toBe('ready');
	});
});
