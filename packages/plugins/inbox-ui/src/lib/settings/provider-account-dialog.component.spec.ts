import { TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { of, throwError } from 'rxjs';
import {
	IEmailProviderDescriptor,
	IInboxProviderAccount,
	InboxProviderAccountScopeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { InboxProviderAccountDialogComponent } from './provider-account-dialog.component';

const postmark: IEmailProviderDescriptor = {
	id: 'postmark',
	displayName: 'Postmark',
	capabilities: { inbound: true, outbound: true, customDomains: true },
	configSchema: {
		type: 'object',
		properties: {
			serverToken: { type: 'string', title: 'Server token', writeOnly: true },
			webhookPassword: { type: 'string', title: 'Webhook password', generated: true },
			fromAddress: { type: 'string', format: 'email' }
		},
		required: ['serverToken']
	}
};
const inboundOnly: IEmailProviderDescriptor = {
	id: 'generic',
	displayName: 'Signed webhook',
	capabilities: { inbound: true, outbound: false, customDomains: true },
	configSchema: { type: 'object', properties: {} }
};

/** The provider-account dialog: it saves by itself and closes with the API's answer. */
describe('InboxProviderAccountDialogComponent', () => {
	const api = { createAccount: jest.fn(), updateAccount: jest.fn() };
	const dialogRef = { close: jest.fn() };

	function render(context: Partial<InboxProviderAccountDialogComponent>) {
		TestBed.configureTestingModule({
			imports: [InboxProviderAccountDialogComponent],
			providers: [
				{ provide: InboxEmailSettingsService, useValue: api },
				{ provide: NbDialogRef, useValue: dialogRef }
			]
		});
		const fixture = TestBed.createComponent(InboxProviderAccountDialogComponent);
		Object.assign(fixture.componentInstance, {
			providers: [postmark, inboundOnly],
			organizationId: 'org-1',
			...context
		});
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance };
	}

	beforeEach(() => jest.resetAllMocks());

	it('a new account: refuses to save without the required secret, then sends the typed configuration', () => {
		const { component } = render({ initialProviderId: 'postmark' });
		expect(component.name()).toBe('Postmark');
		component.save();
		expect(api.createAccount).not.toHaveBeenCalled();
		expect(component.shownErrors()).toHaveProperty('serverToken');

		api.createAccount.mockReturnValue(of({ id: 'new', oneTimeSecrets: { webhookPassword: 'x' } }));
		component.configState.set({
			values: { ...component.configState().values, serverToken: 'token-1', fromAddress: 'support@acme.test' },
			reset: []
		});
		component.isDefaultOutbound.set(true);
		component.save();
		expect(api.createAccount).toHaveBeenCalledWith({
			providerId: 'postmark',
			name: 'Postmark',
			scope: InboxProviderAccountScopeEnum.ORGANIZATION,
			organizationId: 'org-1',
			config: { serverToken: 'token-1', fromAddress: 'support@acme.test' },
			isDefaultOutbound: true
		});
		expect(dialogRef.close).toHaveBeenCalledWith({
			account: { id: 'new', oneTimeSecrets: { webhookPassword: 'x' } }
		});
	});

	it('only a user with ALL_ORG_EDIT picks a tenant-wide scope', () => {
		const { component } = render({ initialProviderId: 'generic', canManageTenant: false });
		component.scope.set(InboxProviderAccountScopeEnum.TENANT);
		api.createAccount.mockReturnValue(of({ id: 'new', oneTimeSecrets: {} }));
		component.save();
		expect(api.createAccount.mock.calls[0][0].scope).toBe(InboxProviderAccountScopeEnum.ORGANIZATION);
		// A provider that does not send is never the outbound default.
		expect(api.createAccount.mock.calls[0][0]).not.toHaveProperty('isDefaultOutbound');
	});

	it('an edit sends only what changed: a rename does not send the configuration', () => {
		const stored = {
			id: 'account-1',
			providerId: 'postmark',
			name: 'Postmark (support)',
			scope: InboxProviderAccountScopeEnum.ORGANIZATION,
			status: InboxProviderAccountStatusEnum.ACTIVE,
			isDefaultOutbound: false,
			config: { fromAddress: 'support@acme.test' },
			secretsSet: ['serverToken', 'webhookPassword']
		} as IInboxProviderAccount;
		const { component } = render({ account: stored });
		api.updateAccount.mockReturnValue(of({ ...stored, oneTimeSecrets: {} }));

		component.name.set('Postmark (billing)');
		component.save();
		expect(api.updateAccount).toHaveBeenLastCalledWith('account-1', { name: 'Postmark (billing)' }, 'org-1');

		// Asking for a new webhook credential sends it as null (the server generates it and answers it once).
		component.configState.set({ ...component.configState(), reset: ['webhookPassword'] });
		component.save();
		expect(api.updateAccount.mock.calls[1][1]).toEqual({
			name: 'Postmark (billing)',
			config: { webhookPassword: null, fromAddress: 'support@acme.test' }
		});
	});

	it('keeps everything typed and shows the API refusal', () => {
		const { component } = render({ initialProviderId: 'postmark' });
		component.configState.set({ ...component.configState(), values: { serverToken: 'bad' } });
		api.createAccount.mockReturnValue(
			throwError(() => ({
				status: 400,
				error: { message: 'Server token is not in the expected format.', field: 'serverToken' }
			}))
		);
		component.save();
		expect(component.apiError()).toBe('Server token is not in the expected format.');
		expect(component.saving()).toBe(false);
		expect(component.configState().values['serverToken']).toBe('bad');
		expect(dialogRef.close).not.toHaveBeenCalled();
	});
});
