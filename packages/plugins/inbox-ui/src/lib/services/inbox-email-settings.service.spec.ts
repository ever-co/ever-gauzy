import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InboxMailboxOwnerTypeEnum, InboxProviderAccountStatusEnum } from '@gauzy/contracts';
import { InboxEmailSettingsService } from './inbox-email-settings.service';

/** The Inbox email management routes (the root test defaults provide the testing HttpClient). */
describe('InboxEmailSettingsService', () => {
	let http: HttpTestingController;
	let api: InboxEmailSettingsService;

	beforeEach(() => {
		http = TestBed.inject(HttpTestingController);
		api = TestBed.inject(InboxEmailSettingsService);
	});

	afterEach(() => http.verify());

	it('reads the providers and the accounts of the organization', () => {
		api.providers().subscribe();
		http.expectOne('/api/inbox/providers').flush([]);

		api.accounts('org-1').subscribe();
		const list = http.expectOne((req) => req.url === '/api/inbox/provider-accounts');
		expect(list.request.params.get('organizationId')).toBe('org-1');
		list.flush([]);
	});

	it('creates, changes, tests and removes an account', () => {
		api.createAccount({
			providerId: 'resend',
			name: 'Resend',
			organizationId: 'org-1',
			config: { apiKey: 'k' }
		}).subscribe();
		const create = http.expectOne('/api/inbox/provider-accounts');
		expect([create.request.method, create.request.body.providerId]).toEqual(['POST', 'resend']);
		create.flush({});

		api.updateAccount('a/1', { status: InboxProviderAccountStatusEnum.DISABLED }, 'org-1').subscribe();
		const update = http.expectOne((req) => req.url === '/api/inbox/provider-accounts/a%2F1');
		expect([update.request.method, update.request.params.get('organizationId')]).toEqual(['PATCH', 'org-1']);
		update.flush({});

		api.verifyAccount('a1').subscribe();
		const verify = http.expectOne('/api/inbox/provider-accounts/a1/verify');
		expect(verify.request.method).toBe('POST');
		expect(verify.request.params.has('organizationId')).toBe(false);
		verify.flush({ ok: true, checkedAt: new Date().toISOString() });

		api.removeAccount('a1', 'org-1').subscribe();
		const remove = http.expectOne((req) => req.url === '/api/inbox/provider-accounts/a1');
		expect(remove.request.method).toBe('DELETE');
		remove.flush({ id: 'a1', deleted: true });
	});

	it('reads and changes the mailboxes, their DNS records, members and settings', () => {
		api.myMailboxes().subscribe();
		http.expectOne('/api/inbox/mailboxes/mine').flush([]);

		api.mailboxes('org-1').subscribe();
		http.expectOne((req) => req.url === '/api/inbox/mailboxes' && req.method === 'GET').flush([]);

		api.createMailbox({ ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION, localPart: 'support' }).subscribe();
		expect(
			http.expectOne((req) => req.url === '/api/inbox/mailboxes' && req.method === 'POST').request.body
		).toEqual({
			ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
			localPart: 'support'
		});

		api.mailboxVerification('m1', 'org-1').subscribe();
		http.expectOne((req) => req.url === '/api/inbox/mailboxes/m1/verification').flush({});

		api.verifyMailbox('m1', 'org-1').subscribe();
		expect(http.expectOne((req) => req.url === '/api/inbox/mailboxes/m1/verify').request.method).toBe('POST');

		api.setMembers('m1', [{ userId: 'u1' }], 'org-1').subscribe();
		const members = http.expectOne((req) => req.url === '/api/inbox/mailboxes/m1/members');
		expect([members.request.method, members.request.body]).toEqual(['PUT', { members: [{ userId: 'u1' }] }]);

		api.updateEmailSettings(true, 'org-1').subscribe();
		const settings = http.expectOne((req) => req.url === '/api/inbox/mailboxes/settings');
		expect([settings.request.method, settings.request.body]).toEqual(['PUT', { autoProvisionEmployees: true }]);

		api.provision({ organizationId: 'org-1', employees: true }).subscribe();
		expect(http.expectOne('/api/inbox/mailboxes/provision').request.body).toEqual({
			organizationId: 'org-1',
			employees: true
		});
	});
});
