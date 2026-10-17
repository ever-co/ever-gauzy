import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InboxMailboxKindEnum, InboxMailboxOwnerTypeEnum, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { InboxMyMailboxPageComponent } from './my-mailbox-page.component';

/** "My mailbox": my addresses and the API's forwarding instructions. */
describe('InboxMyMailboxPageComponent', () => {
	const api = { myMailboxes: jest.fn() };
	const permissions = new Set<string>();

	function render() {
		TestBed.configureTestingModule({
			imports: [InboxMyMailboxPageComponent],
			providers: [
				{ provide: InboxEmailSettingsService, useValue: api },
				{ provide: ToastrService, useValue: { success: jest.fn() } },
				{ provide: Store, useValue: { hasPermission: (permission: string) => permissions.has(permission) } }
			]
		});
		const fixture = TestBed.createComponent(InboxMyMailboxPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			component: fixture.componentInstance,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null
		};
	}

	beforeEach(() => {
		jest.resetAllMocks();
		permissions.clear();
	});

	it('the email features are off (404): the notice only', () => {
		api.myMailboxes.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view()).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
	});

	it('lists my mailboxes with the forwarding instructions the API wrote', () => {
		api.myMailboxes.mockReturnValue(
			of([
				{
					id: 'm1',
					address: 'ada.lovelace.acme@inbox.example.test',
					kind: InboxMailboxKindEnum.PLATFORM,
					ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
					forwardingInstructions:
						'Forward the mail you want in Gauzy to ada.lovelace.acme@inbox.example.test.'
				},
				{
					id: 'm2',
					address: 'support.acme@inbox.example.test',
					kind: InboxMailboxKindEnum.PLATFORM,
					ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION
				}
			])
		);
		const { find } = render();
		expect(find('my-mailbox-m1')?.textContent).toContain('ada.lovelace.acme@inbox.example.test');
		expect(find('instructions-m1')?.textContent).toContain('Forward the mail you want in Gauzy');
		expect(find('instructions-m2')).toBeNull();
		// Not a manager: no link to the settings.
		expect(find('manage')).toBeNull();
	});

	it('none yet: says so, and points a manager to the settings', () => {
		permissions.add(PermissionsEnum.INBOX_MAILBOX_MANAGE);
		api.myMailboxes.mockReturnValue(of([]));
		const { find } = render();
		expect(find('empty')).not.toBeNull();
		expect(find('manage')).not.toBeNull();
	});
});
