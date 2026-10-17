import { TestBed } from '@angular/core/testing';
import { NbDialogService } from '@nebular/theme';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import {
	IInboxMailbox,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxOwnerTypeEnum,
	InboxMailboxPurposeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { InboxDirectoryService } from '../services/inbox-directory.service';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { InboxMailboxesPageComponent } from './inbox-mailboxes-page.component';
import { InboxMailboxCreateDialogComponent } from './mailbox-create-dialog.component';
import { InboxMailboxMembersDialogComponent } from './mailbox-members-dialog.component';
import { EVER_WORKS_AGENT_SETTING } from './mailbox-settings.helpers';
import { InboxOneTimeSecretDialogComponent } from './one-time-secret-dialog.component';

const DOMAIN = 'inbox.example.test';

const mailbox = (id: string, overrides: Partial<IInboxMailbox> = {}): IInboxMailbox =>
	({
		id,
		address: `${id}.acme@${DOMAIN}`,
		displayName: null,
		kind: InboxMailboxKindEnum.PLATFORM,
		ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
		purpose: InboxMailboxPurposeEnum.INBOX,
		isActive: true,
		isDefault: false,
		messageCount: 0,
		settings: null,
		...overrides
	}) as IInboxMailbox;

/** Settings → Inbox → Mailboxes. */
describe('InboxMailboxesPageComponent', () => {
	const api = {
		mailboxes: jest.fn(),
		emailSettings: jest.fn(),
		accounts: jest.fn(),
		mailboxVerification: jest.fn(),
		verifyMailbox: jest.fn(),
		updateMailbox: jest.fn(),
		updateEmailSettings: jest.fn(),
		provision: jest.fn(),
		rotateMailboxSecret: jest.fn()
	};
	const directory = { everWorksAgents: jest.fn() };
	const dialogs = { open: jest.fn() };
	const toastr = { success: jest.fn(), warning: jest.fn(), danger: jest.fn() };
	let organization$: BehaviorSubject<{ id: string; tenantId: string }>;

	function render() {
		TestBed.configureTestingModule({
			imports: [InboxMailboxesPageComponent],
			providers: [
				{ provide: InboxEmailSettingsService, useValue: api },
				{ provide: InboxDirectoryService, useValue: directory },
				{ provide: NbDialogService, useValue: dialogs },
				{ provide: ToastrService, useValue: toastr },
				{
					provide: Store,
					useValue: {
						selectedOrganization$: organization$,
						user: { tenantId: 'tenant-1' },
						hasPermission: () => false
					}
				}
			]
		});
		const fixture = TestBed.createComponent(InboxMailboxesPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			fixture,
			component: fixture.componentInstance,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null
		};
	}

	function served(mailboxes: IInboxMailbox[], platformDomain: string | null = DOMAIN) {
		api.mailboxes.mockReturnValue(of(mailboxes));
		api.emailSettings.mockReturnValue(
			of({ organizationId: 'org-1', autoProvisionEmployees: false, platformDomain })
		);
		api.accounts.mockReturnValue(
			of([
				{
					id: 'acc-1',
					name: 'Resend (acme.test)',
					status: InboxProviderAccountStatusEnum.ACTIVE,
					capabilities: { inbound: true, outbound: true, customDomains: true }
				}
			])
		);
	}

	beforeEach(() => {
		jest.resetAllMocks();
		organization$ = new BehaviorSubject({ id: 'org-1', tenantId: 'tenant-1' });
	});

	it('the email features are off (404): the notice only', () => {
		api.mailboxes.mockReturnValue(throwError(() => ({ status: 404 })));
		api.emailSettings.mockReturnValue(throwError(() => ({ status: 404 })));
		api.accounts.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view()).toBe('unavailable');
		expect(find('add-mailbox')).toBeNull();
	});

	it('shows the platform domain from the API and groups shared and personal mailboxes', () => {
		served([
			mailbox('support', { isDefault: true }),
			mailbox('ada', { ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE, ownerEmployeeId: 'e1' })
		]);
		const { component, find } = render();
		expect(api.mailboxes).toHaveBeenCalledWith('org-1');
		// The text is the translated sentence with the domain in it; the spec's translations are the keys.
		expect(component.platformDomain()).toBe(DOMAIN);
		expect(find('platform-domain')?.textContent).toContain('INBOX.SETTINGS.MAILBOXES.PLATFORM_DOMAIN');
		expect(find('group-SHARED')?.querySelector('[data-test="mailbox-support"]')).not.toBeNull();
		expect(find('group-PERSONAL')?.querySelector('[data-test="mailbox-ada"]')).not.toBeNull();
		expect(find('default-support')).not.toBeNull();
		// Members are a shared mailbox's only.
		expect(find('members-support')).not.toBeNull();
		expect(find('members-ada')).toBeNull();
	});

	it('without a platform domain: says so, and provisioning is off', () => {
		served([], null);
		const { find } = render();
		expect(find('no-platform-domain')).not.toBeNull();
		expect((find('provision-employees') as HTMLButtonElement).disabled).toBe(true);
	});

	it('shows the DNS record of a custom domain and checks it on demand', () => {
		const custom = mailbox('billing', {
			address: 'billing@acme.test',
			kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
			domain: 'acme.test',
			domainStatus: InboxMailboxDomainStatusEnum.PENDING,
			providerAccountId: 'acc-1'
		});
		served([custom]);
		const record = {
			recordType: 'TXT' as const,
			recordName: '_gauzy-inbox.acme.test',
			recordValue: 'gauzy-inbox-verify=abc',
			status: InboxMailboxDomainStatusEnum.PENDING
		};
		api.mailboxVerification.mockReturnValue(of(record));
		const { component, fixture, find } = render();
		fixture.detectChanges();
		expect(api.mailboxVerification).toHaveBeenCalledWith('billing', 'org-1');
		expect(find('dns-billing')?.textContent).toContain('gauzy-inbox-verify=abc');
		expect(find('mailbox-billing')?.textContent).toContain('Resend (acme.test)');

		api.verifyMailbox.mockReturnValue(of({ ...record, status: InboxMailboxDomainStatusEnum.VERIFIED }));
		component.verify(component.rows()[0]);
		expect(component.mailboxes()[0].domainStatus).toBe(InboxMailboxDomainStatusEnum.VERIFIED);
		expect(toastr.success).toHaveBeenCalledWith('INBOX.SETTINGS.MAILBOXES.DOMAIN_VERIFIED');

		// Not found: an answer, not a failure.
		api.verifyMailbox.mockReturnValue(
			of({
				...record,
				status: InboxMailboxDomainStatusEnum.PENDING,
				message: 'The expected TXT record was not found.'
			})
		);
		component.verify(component.rows()[0]);
		expect(toastr.warning).toHaveBeenCalledWith('The expected TXT record was not found.');
	});

	it('names the Ever Works agent a mailbox is routed to', () => {
		served([mailbox('support', { settings: { [EVER_WORKS_AGENT_SETTING]: 'agent-1' } })]);
		directory.everWorksAgents.mockReturnValue(of([{ id: 'agent-1', name: 'Support agent' }]));
		const { find, fixture } = render();
		fixture.detectChanges();
		expect(directory.everWorksAgents).toHaveBeenCalledWith('org-1', 'tenant-1');
		expect(find('agent-support')?.textContent).toContain('Support agent');
	});

	it('opens the create dialog with the platform domain and the accounts, and reads the list again after it', () => {
		served([]);
		dialogs.open.mockReturnValue({ onClose: of({ mailbox: mailbox('new') }) });
		const { find } = render();
		find('add-mailbox')?.click();
		expect(dialogs.open.mock.calls[0][0]).toBe(InboxMailboxCreateDialogComponent);
		expect(dialogs.open.mock.calls[0][1]).toMatchObject({
			context: { organizationId: 'org-1', tenantId: 'tenant-1', platformDomain: DOMAIN },
			closeOnEsc: false,
			closeOnBackdropClick: false
		});
		expect(api.mailboxes).toHaveBeenCalledTimes(2);
	});

	it('opens the members of a shared mailbox', () => {
		served([mailbox('support')]);
		dialogs.open.mockReturnValue({ onClose: of(undefined) });
		const { find } = render();
		find('members-support')?.click();
		expect(dialogs.open.mock.calls[0][0]).toBe(InboxMailboxMembersDialogComponent);
	});

	it('deactivates a mailbox; a refusal is shown', () => {
		served([mailbox('support')]);
		api.updateMailbox.mockReturnValueOnce(of(mailbox('support', { isActive: false })));
		const { component } = render();
		component.setActive(component.rows()[0], false);
		expect(api.updateMailbox).toHaveBeenCalledWith('support', { isActive: false }, 'org-1');
		expect(component.mailboxes()[0].isActive).toBe(false);

		api.updateMailbox.mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'Nope.' } })));
		component.setActive(component.rows()[0], true);
		expect(component.actionError()).toBe('Nope.');
	});

	it('provisions the missing mailboxes and turns auto-provisioning on', () => {
		served([]);
		api.provision.mockReturnValue(of({ created: [mailbox('ada')], existing: 0 }));
		api.updateEmailSettings.mockReturnValue(
			of({ organizationId: 'org-1', autoProvisionEmployees: true, platformDomain: DOMAIN })
		);
		const { component } = render();
		component.provision('employees');
		expect(api.provision).toHaveBeenCalledWith({ organizationId: 'org-1', employees: true });
		expect(toastr.success).toHaveBeenCalledWith('INBOX.SETTINGS.MAILBOXES.PROVISIONED', { count: 1 });
		component.setAutoProvision(true);
		expect(api.updateEmailSettings).toHaveBeenCalledWith(true, 'org-1');
		expect(component.settings()?.autoProvisionEmployees).toBe(true);
	});

	it('a new relay secret is shown once, after a confirmation', () => {
		served([mailbox('support')]);
		api.rotateMailboxSecret.mockReturnValue(of({ address: 'support.acme@x', inboundSecret: 'secret-1' }));
		const { component, find, fixture } = render();
		find('rotate-support')?.click();
		fixture.detectChanges();
		find('confirm-rotate-yes-support')?.click();
		expect(dialogs.open.mock.calls[0][0]).toBe(InboxOneTimeSecretDialogComponent);
		expect(dialogs.open.mock.calls[0][1]).toMatchObject({ closeOnEsc: false, closeOnBackdropClick: false });
		expect(dialogs.open.mock.calls[0][1].context.values[1].value).toBe('secret-1');
		expect(component.confirmRotate()).toBeNull();
	});

	it('drops an answer that arrives after another organization was selected', () => {
		served([]);
		const pending = new Subject<{
			organizationId: string;
			autoProvisionEmployees: boolean;
			platformDomain: string;
		}>();
		api.updateEmailSettings.mockReturnValue(pending);
		const { component } = render();
		component.setAutoProvision(true);

		api.emailSettings.mockReturnValue(
			of({ organizationId: 'org-2', autoProvisionEmployees: false, platformDomain: DOMAIN })
		);
		organization$.next({ id: 'org-2', tenantId: 'tenant-1' });
		expect(api.mailboxes).toHaveBeenLastCalledWith('org-2');

		pending.next({ organizationId: 'org-1', autoProvisionEmployees: true, platformDomain: DOMAIN });
		expect(component.settings()).toMatchObject({ organizationId: 'org-2', autoProvisionEmployees: false });
		expect(component.busy().has('settings')).toBe(false);
	});
});
