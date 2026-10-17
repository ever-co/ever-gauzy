import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IEmailProviderConfigSchema, IInboxProviderAccount } from '@gauzy/contracts';
import { InboxProviderConfigFormComponent } from './provider-config-form.component';
import {
	initialProviderConfigState,
	IProviderConfigError,
	IProviderConfigFormState
} from './provider-config-form.helpers';

const schema: IEmailProviderConfigSchema = {
	type: 'object',
	properties: {
		apiKey: { type: 'string', title: 'API key', writeOnly: true },
		signingKey: { type: 'string', title: 'Signing key', writeOnly: true },
		webhookPassword: { type: 'string', title: 'Webhook password', generated: true },
		fromAddress: { type: 'string', title: 'From address', format: 'email', description: 'The default sender.' },
		region: { type: 'string', enum: ['us', 'eu'] },
		sandbox: { type: 'boolean', title: 'Sandbox' }
	},
	required: ['apiKey']
};

@Component({
	selector: 'ngx-config-form-host',
	imports: [InboxProviderConfigFormComponent],
	template: `<ngx-inbox-provider-config-form
		[schema]="schema"
		[account]="account()"
		[errors]="errors()"
		[(state)]="state"
	></ngx-inbox-provider-config-form>`
})
class HostComponent {
	schema = schema;
	readonly account = signal<IInboxProviderAccount | null>(null);
	readonly errors = signal<Record<string, IProviderConfigError>>({});
	readonly state = signal<IProviderConfigFormState>(initialProviderConfigState(schema));
}

/** The generic form: every field of the schema, secrets write-only. */
describe('InboxProviderConfigFormComponent', () => {
	function render(account: IInboxProviderAccount | null = null) {
		TestBed.configureTestingModule({ imports: [HostComponent] });
		const fixture = TestBed.createComponent(HostComponent);
		fixture.componentInstance.account.set(account);
		fixture.componentInstance.state.set(initialProviderConfigState(schema, account));
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const form = fixture.debugElement.children[0].componentInstance as InboxProviderConfigFormComponent;
		return {
			fixture,
			host: fixture.componentInstance,
			form,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null
		};
	}

	it('renders one field per property, with the labels and help texts of the provider', () => {
		const { find } = render();
		for (const name of ['apiKey', 'signingKey', 'webhookPassword', 'fromAddress', 'region', 'sandbox']) {
			expect(find(`field-${name}`)).not.toBeNull();
		}
		expect(find('field-apiKey')?.textContent).toContain('API key');
		expect(find('field-fromAddress')?.textContent).toContain('The default sender.');
		expect((find('input-apiKey') as HTMLInputElement).type).toBe('password');
		expect((find('input-fromAddress') as HTMLInputElement).type).toBe('email');
		// A generated secret has no input: the server makes it.
		expect(find('input-webhookPassword')).toBeNull();
		expect(find('generated-webhookPassword')).not.toBeNull();
	});

	it('an edit says which secrets are set and never shows their values', async () => {
		const stored = {
			id: 'account-1',
			providerId: 'fake',
			name: 'Fake',
			config: { fromAddress: 'support@acme.test' },
			secretsSet: ['apiKey', 'signingKey', 'webhookPassword']
		} as unknown as IInboxProviderAccount;
		const { find, fixture } = render(stored);
		// ngModel writes the inputs once the first change detection settled.
		await fixture.whenStable();
		fixture.detectChanges();
		expect(find('secret-set-apiKey')).not.toBeNull();
		expect((find('input-apiKey') as HTMLInputElement).value).toBe('');
		expect((find('input-fromAddress') as HTMLInputElement).value).toBe('support@acme.test');
		// An optional set secret can be cleared; a required one can only be replaced; a generated one rotated.
		expect(find('clear-signingKey')).not.toBeNull();
		expect(find('clear-apiKey')).toBeNull();
		expect(find('rotate-webhookPassword')).not.toBeNull();
	});

	it('writes typed values and resets into the state', () => {
		const { host, form, fixture } = render();
		const field = form.fields().find((entry) => entry.name === 'fromAddress')!;
		form.set(field, 'billing@acme.test');
		const secret = form.fields().find((entry) => entry.name === 'signingKey')!;
		form.set(secret, 'typed');
		form.setReset(secret, true);
		fixture.detectChanges();
		expect(host.state().values['fromAddress']).toBe('billing@acme.test');
		// Resetting drops a typed value: the field is sent as null.
		expect(host.state().values['signingKey']).toBe('');
		expect(host.state().reset).toEqual(['signingKey']);
		form.setReset(secret, false);
		expect(host.state().reset).toEqual([]);
	});

	it('shows the errors it is given', () => {
		const { host, fixture, find } = render();
		host.errors.set({ apiKey: { key: 'INBOX.SETTINGS.FORM.ERRORS.REQUIRED' } });
		fixture.detectChanges();
		expect(find('error-apiKey')).not.toBeNull();
		expect(find('error-fromAddress')).toBeNull();
	});
});
