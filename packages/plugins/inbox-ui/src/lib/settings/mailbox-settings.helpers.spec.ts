import {
	IInboxMailbox,
	IInboxProviderAccount,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxOwnerTypeEnum,
	InboxMailboxPurposeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';
import {
	agentOfMailbox,
	domainStatusTone,
	emptyMailboxCreateForm,
	EVER_WORKS_AGENT_SETTING,
	forwardFromOf,
	isSharedMailbox,
	MAILBOX_ERROR_KEYS,
	mailboxCreateErrors,
	mailboxCreateInput,
	mailboxEditErrors,
	mailboxEditForm,
	mailboxUpdateInput,
	parseAllowlist,
	receivingAccounts,
	settingsWithAgent
} from './mailbox-settings.helpers';

const DOMAIN = 'inbox.example.test';

const mailbox = (overrides: Partial<IInboxMailbox> = {}): IInboxMailbox =>
	({
		id: 'm1',
		address: `support.acme@${DOMAIN}`,
		displayName: 'Support',
		kind: InboxMailboxKindEnum.PLATFORM,
		ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
		purpose: InboxMailboxPurposeEnum.INBOX,
		providerAccountId: null,
		senderAllowlist: ['@vendor.test'],
		isDefault: false,
		settings: null,
		...overrides
	}) as IInboxMailbox;

describe('mailbox settings helpers', () => {
	describe('the "Add mailbox" form', () => {
		it('starts with a platform address, or a custom domain where the server has no platform domain', () => {
			expect(emptyMailboxCreateForm(DOMAIN).kind).toBe(InboxMailboxKindEnum.PLATFORM);
			expect(emptyMailboxCreateForm(null).kind).toBe(InboxMailboxKindEnum.CUSTOM_DOMAIN);
		});

		it('an organization platform mailbox needs nothing; a name part must fit an address', () => {
			const form = emptyMailboxCreateForm(DOMAIN);
			expect(mailboxCreateErrors(form, DOMAIN)).toEqual({});
			expect(mailboxCreateErrors({ ...form, localPart: 'Sales.EU' }, DOMAIN)).toEqual({});
			expect(mailboxCreateErrors({ ...form, localPart: 'sales eu' }, DOMAIN)).toEqual({
				localPart: { key: MAILBOX_ERROR_KEYS.LOCAL_PART }
			});
			// Without a platform domain, only a custom domain works.
			expect(mailboxCreateErrors(form, null)).toEqual({ kind: { key: MAILBOX_ERROR_KEYS.NO_PLATFORM_DOMAIN } });
		});

		it('an employee or a team mailbox needs its owner', () => {
			const form = emptyMailboxCreateForm(DOMAIN);
			expect(mailboxCreateErrors({ ...form, ownerType: InboxMailboxOwnerTypeEnum.TEAM }, DOMAIN)).toHaveProperty(
				'owner'
			);
			expect(
				mailboxCreateErrors(
					{ ...form, ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE, ownerEmployeeId: 'e1' },
					DOMAIN
				)
			).toEqual({});
		});

		it('a custom domain needs an address, a valid domain outside the platform, and a receiving account', () => {
			const form = { ...emptyMailboxCreateForm(DOMAIN), kind: InboxMailboxKindEnum.CUSTOM_DOMAIN } as const;
			expect(Object.keys(mailboxCreateErrors(form, DOMAIN)).sort()).toEqual([
				'domain',
				'localPart',
				'providerAccountId'
			]);
			expect(
				mailboxCreateErrors({ ...form, localPart: 'billing', domain: 'acme', providerAccountId: 'a1' }, DOMAIN)
			).toEqual({ domain: { key: MAILBOX_ERROR_KEYS.DOMAIN } });
			expect(
				mailboxCreateErrors(
					{ ...form, localPart: 'billing', domain: `eu.${DOMAIN}`, providerAccountId: 'a1' },
					DOMAIN
				)
			).toEqual({ domain: { key: MAILBOX_ERROR_KEYS.RESERVED_DOMAIN } });
			expect(
				mailboxCreateErrors(
					{ ...form, localPart: 'billing', domain: 'Acme.Test.', providerAccountId: 'a1' },
					DOMAIN
				)
			).toEqual({});
		});

		it('checks the allowlist and a forwarding address', () => {
			const form = { ...emptyMailboxCreateForm(DOMAIN), kind: InboxMailboxKindEnum.FORWARDING } as const;
			expect(
				mailboxCreateErrors({ ...form, forwardFrom: 'not-an-address', allowlist: 'a@b.test\nnope' }, DOMAIN)
			).toEqual({
				forwardFrom: { key: MAILBOX_ERROR_KEYS.ADDRESS },
				allowlist: { key: MAILBOX_ERROR_KEYS.ALLOWLIST, params: { entry: 'nope' } }
			});
		});

		it('sends only what applies to the owner and the kind', () => {
			const form = emptyMailboxCreateForm(DOMAIN);
			expect(
				mailboxCreateInput(
					{
						...form,
						ownerType: InboxMailboxOwnerTypeEnum.TEAM,
						ownerTeamId: 't1',
						ownerEmployeeId: 'stale',
						localPart: ' Design ',
						domain: 'ignored.test',
						allowlist: '@Vendor.test, a@b.test\n@vendor.test',
						isDefault: true
					},
					'org-1'
				)
			).toEqual({
				ownerType: InboxMailboxOwnerTypeEnum.TEAM,
				ownerTeamId: 't1',
				kind: InboxMailboxKindEnum.PLATFORM,
				localPart: 'design',
				senderAllowlist: ['@vendor.test', 'a@b.test'],
				isDefault: true,
				organizationId: 'org-1'
			});
			expect(
				mailboxCreateInput({
					...form,
					kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
					localPart: 'billing',
					domain: 'Acme.Test.',
					providerAccountId: 'a1'
				})
			).toEqual({
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
				localPart: 'billing',
				domain: 'acme.test',
				providerAccountId: 'a1'
			});
		});
	});

	describe('the "Edit mailbox" form', () => {
		it('sends only what changed', () => {
			const stored = mailbox();
			const form = mailboxEditForm(stored);
			expect(form).toEqual({
				displayName: 'Support',
				allowlist: '@vendor.test',
				providerAccountId: null,
				isDefault: false,
				everWorksAgentId: null
			});
			expect(mailboxUpdateInput(form, stored)).toEqual({});
			expect(mailboxUpdateInput({ ...form, displayName: ' ', allowlist: '', isDefault: true }, stored)).toEqual({
				displayName: null,
				senderAllowlist: [],
				isDefault: true
			});
		});

		it('routes to an Ever Works agent by merging into the other settings, and removes it the same way', () => {
			const stored = mailbox({
				kind: InboxMailboxKindEnum.FORWARDING,
				settings: { forwardFrom: 'me@acme.test' }
			});
			const routed = mailboxUpdateInput(
				{ ...mailboxEditForm(stored), everWorksAgentId: 'agent-employee-1' },
				stored
			);
			expect(routed).toEqual({
				settings: { forwardFrom: 'me@acme.test', [EVER_WORKS_AGENT_SETTING]: 'agent-employee-1' }
			});

			const withAgent = mailbox({ settings: { [EVER_WORKS_AGENT_SETTING]: 'agent-employee-1' } });
			expect(agentOfMailbox(withAgent)).toBe('agent-employee-1');
			expect(mailboxUpdateInput({ ...mailboxEditForm(withAgent), everWorksAgentId: null }, withAgent)).toEqual({
				settings: null
			});
		});

		it('a custom-domain mailbox keeps a receiving account', () => {
			const stored = mailbox({ kind: InboxMailboxKindEnum.CUSTOM_DOMAIN, providerAccountId: 'a1' });
			expect(mailboxEditErrors({ ...mailboxEditForm(stored), providerAccountId: null }, stored)).toEqual({
				providerAccountId: { key: MAILBOX_ERROR_KEYS.REQUIRED }
			});
			expect(mailboxUpdateInput({ ...mailboxEditForm(stored), providerAccountId: 'a2' }, stored)).toEqual({
				providerAccountId: 'a2'
			});
			// A platform mailbox never sends an account.
			expect(mailboxUpdateInput({ ...mailboxEditForm(mailbox()), providerAccountId: 'a2' }, mailbox())).toEqual(
				{}
			);
		});
	});

	it('reads allowlists, settings, owners, accounts and statuses', () => {
		expect(parseAllowlist(' A@B.test ;@c.test,,a@b.test ')).toEqual(['a@b.test', '@c.test']);
		expect(settingsWithAgent(null, null)).toBeNull();
		expect(settingsWithAgent({ x: 1 }, 'agent')).toEqual({ x: 1, [EVER_WORKS_AGENT_SETTING]: 'agent' });
		expect(forwardFromOf(mailbox({ settings: { forwardFrom: 'me@acme.test' } }))).toBe('me@acme.test');
		expect(isSharedMailbox({ ownerType: InboxMailboxOwnerTypeEnum.TEAM })).toBe(true);
		expect(isSharedMailbox({ ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE })).toBe(false);
		const accounts = [
			{ id: 'in', status: InboxProviderAccountStatusEnum.ACTIVE, capabilities: { inbound: true } },
			{ id: 'off', status: InboxProviderAccountStatusEnum.DISABLED, capabilities: { inbound: true } },
			{ id: 'out', status: InboxProviderAccountStatusEnum.ERROR, capabilities: { inbound: false } }
		] as IInboxProviderAccount[];
		expect(receivingAccounts(accounts).map((account) => account.id)).toEqual(['in']);
		expect(domainStatusTone(InboxMailboxDomainStatusEnum.VERIFIED)).toBe('success');
		expect(domainStatusTone(InboxMailboxDomainStatusEnum.FAILED)).toBe('danger');
		expect(domainStatusTone(null)).toBe('warning');
	});
});
