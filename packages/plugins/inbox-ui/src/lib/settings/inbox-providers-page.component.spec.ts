import { TestBed } from '@angular/core/testing';
import { NbDialogService } from '@nebular/theme';
import { of, throwError } from 'rxjs';
import {
	IEmailProviderDescriptor,
	IInboxProviderAccount,
	InboxProviderAccountScopeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { InboxProvidersPageComponent } from './inbox-providers-page.component';
import { InboxOneTimeSecretDialogComponent } from './one-time-secret-dialog.component';
import { InboxProviderAccountDialogComponent } from './provider-account-dialog.component';

const resend: IEmailProviderDescriptor = {
	id: 'resend',
	displayName: 'Resend',
	capabilities: { inbound: true, outbound: true, customDomains: true },
	configSchema: { type: 'object', properties: { apiKey: { type: 'string', title: 'API key', writeOnly: true } } }
};
const postmark: IEmailProviderDescriptor = {
	id: 'postmark',
	displayName: 'Postmark',
	capabilities: { inbound: true, outbound: true, customDomains: true },
	configSchema: {
		type: 'object',
		properties: {
			serverToken: { type: 'string', title: 'Server token', writeOnly: true },
			webhookPassword: { type: 'string', title: 'Webhook password', generated: true }
		}
	}
};

const account = (id: string, overrides: Partial<IInboxProviderAccount> = {}): IInboxProviderAccount =>
	({
		id,
		providerId: 'resend',
		name: `Account ${id}`,
		scope: InboxProviderAccountScopeEnum.ORGANIZATION,
		status: InboxProviderAccountStatusEnum.ACTIVE,
		isDefaultOutbound: false,
		config: {},
		secretsSet: ['apiKey'],
		capabilities: resend.capabilities,
		webhookUrl: `/api/inbox/inbound/resend/${id}`,
		...overrides
	}) as IInboxProviderAccount;

/** Settings → Inbox → Providers. */
describe('InboxProvidersPageComponent', () => {
	const api = {
		providers: jest.fn(),
		accounts: jest.fn(),
		verifyAccount: jest.fn(),
		updateAccount: jest.fn(),
		removeAccount: jest.fn()
	};
	const dialogs = { open: jest.fn() };
	const toastr = { success: jest.fn(), danger: jest.fn(), warning: jest.fn() };
	const permissions = new Set<string>();

	function render() {
		TestBed.configureTestingModule({
			imports: [InboxProvidersPageComponent],
			providers: [
				{ provide: InboxEmailSettingsService, useValue: api },
				{ provide: NbDialogService, useValue: dialogs },
				{ provide: ToastrService, useValue: toastr },
				{
					provide: Store,
					useValue: {
						selectedOrganization$: of({ id: 'org-1', tenantId: 'tenant-1' }),
						hasPermission: (permission: string) => permissions.has(permission)
					}
				}
			]
		});
		const fixture = TestBed.createComponent(InboxProvidersPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			fixture,
			component: fixture.componentInstance,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null
		};
	}

	beforeEach(() => {
		jest.resetAllMocks();
		permissions.clear();
	});

	it('the email features are off (404): the notice only', () => {
		api.providers.mockReturnValue(throwError(() => ({ status: 404 })));
		api.accounts.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view()).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(find('providers')).toBeNull();
	});

	it('another failure offers a retry', () => {
		api.providers.mockReturnValue(throwError(() => ({ status: 500 })));
		api.accounts.mockReturnValue(of([]));
		const { component, find, fixture } = render();
		expect(component.view()).toBe('error');
		api.providers.mockReturnValue(of([resend]));
		find('retry')?.click();
		fixture.detectChanges();
		expect(component.view()).toBe('ready');
	});

	it('lists the providers and the accounts of the organization, with the webhook URL the API answered', () => {
		api.providers.mockReturnValue(of([resend, postmark]));
		api.accounts.mockReturnValue(
			of([
				account('a'),
				account('b', { providerId: 'postmark', webhookUrl: null, capabilities: postmark.capabilities })
			])
		);
		const { find } = render();
		expect(api.accounts).toHaveBeenCalledWith('org-1');
		expect(find('provider-resend')).not.toBeNull();
		expect(find('provider-postmark')).not.toBeNull();
		expect(find('webhook-a')?.textContent).toContain('/api/inbox/inbound/resend/a');
		// Postmark's URL carries a credential: shown once only.
		expect(find('webhook-once-b')).not.toBeNull();
		expect(find('secrets-a')?.textContent).toContain('API key');
	});

	it('a tenant-wide account is read-only without ALL_ORG_EDIT', () => {
		api.providers.mockReturnValue(of([resend]));
		api.accounts.mockReturnValue(of([account('t', { scope: InboxProviderAccountScopeEnum.TENANT })]));
		const { find } = render();
		expect((find('edit-t') as HTMLButtonElement).disabled).toBe(true);
		expect((find('delete-t') as HTMLButtonElement).disabled).toBe(true);
	});

	it('adding an account opens the provider form, then shows the generated secrets once', () => {
		api.providers.mockReturnValue(of([resend, postmark]));
		api.accounts.mockReturnValue(of([]));
		const created = {
			...account('new', { providerId: 'postmark' }),
			oneTimeSecrets: { webhookPassword: 'generated-secret' },
			oneTimeWebhookUrl: '/api/inbox/inbound/postmark/new?credential'
		};
		dialogs.open
			.mockReturnValueOnce({ onClose: of({ account: created }) })
			.mockReturnValueOnce({ onClose: of(true) });
		const { find } = render();
		find('add-postmark')?.click();

		expect(dialogs.open.mock.calls[0][0]).toBe(InboxProviderAccountDialogComponent);
		expect(dialogs.open.mock.calls[0][1].context).toMatchObject({
			initialProviderId: 'postmark',
			account: null,
			organizationId: 'org-1',
			canManageTenant: false
		});
		expect(dialogs.open.mock.calls[1][0]).toBe(InboxOneTimeSecretDialogComponent);
		expect(dialogs.open.mock.calls[1][1]).toMatchObject({ closeOnEsc: false, closeOnBackdropClick: false });
		expect(dialogs.open.mock.calls[1][1].context.values).toEqual([
			{ label: 'Webhook password', value: 'generated-secret' },
			{
				label: 'INBOX.SETTINGS.PROVIDERS.WEBHOOK_URL',
				translate: true,
				value: '/api/inbox/inbound/postmark/new?credential'
			}
		]);
		// The list is read again (and the one-time values are not kept on the page).
		expect(api.accounts).toHaveBeenCalledTimes(2);
	});

	it('tests the connection and shows the result', () => {
		api.providers.mockReturnValue(of([resend]));
		api.accounts.mockReturnValue(of([account('a')]));
		api.verifyAccount.mockReturnValue(
			of({ ok: false, message: 'The API key was refused.', checkedAt: new Date() })
		);
		const { component, fixture, find } = render();
		component.verify(component.rows()[0]);
		fixture.detectChanges();
		expect(api.verifyAccount).toHaveBeenCalledWith('a', 'org-1');
		expect(find('check-a')?.textContent).toContain('The API key was refused.');
	});

	it('disables and enables an account', () => {
		api.providers.mockReturnValue(of([resend]));
		api.accounts.mockReturnValue(of([account('a')]));
		api.updateAccount.mockReturnValue(
			of({ ...account('a', { status: InboxProviderAccountStatusEnum.DISABLED }), oneTimeSecrets: {} })
		);
		const { component } = render();
		component.setEnabled(component.rows()[0], false);
		expect(api.updateAccount).toHaveBeenCalledWith(
			'a',
			{ status: InboxProviderAccountStatusEnum.DISABLED },
			'org-1'
		);
		expect(component.accounts()[0].status).toBe(InboxProviderAccountStatusEnum.DISABLED);
		expect(component.accounts()[0]).not.toHaveProperty('oneTimeSecrets');
	});

	it('deletes after a confirmation; a refusal (a mailbox still uses it) is shown', () => {
		api.providers.mockReturnValue(of([resend]));
		api.accounts.mockReturnValue(of([account('a'), account('b')]));
		api.removeAccount.mockReturnValueOnce(
			throwError(() => ({ status: 409, error: { message: 'A mailbox receives through this account.' } }))
		);
		const { component, find, fixture } = render();
		find('delete-a')?.click();
		fixture.detectChanges();
		expect(find('confirm-delete-a')).not.toBeNull();
		find('confirm-delete-yes-a')?.click();
		fixture.detectChanges();
		expect(component.actionError()).toBe('A mailbox receives through this account.');
		expect(component.accounts()).toHaveLength(2);

		api.removeAccount.mockReturnValueOnce(of({ id: 'a', deleted: true }));
		component.remove(component.rows()[0]);
		expect(component.accounts().map((entry) => entry.id)).toEqual(['b']);
		expect(toastr.success).toHaveBeenCalledWith('INBOX.SETTINGS.TOAST.DELETED');
	});
});
