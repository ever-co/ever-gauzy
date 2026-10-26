import { TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { of, throwError } from 'rxjs';
import {
	IInboxMailbox,
	IInboxProviderAccount,
	InboxMailboxKindEnum,
	InboxMailboxMemberRoleEnum,
	InboxMailboxOwnerTypeEnum,
	InboxMailboxPurposeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';
import { InboxDirectoryService } from '../services/inbox-directory.service';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { InboxMailboxCreateDialogComponent } from './mailbox-create-dialog.component';
import { InboxMailboxEditDialogComponent } from './mailbox-edit-dialog.component';
import { InboxMailboxMembersDialogComponent } from './mailbox-members-dialog.component';
import { EVER_WORKS_AGENT_SETTING } from './mailbox-settings.helpers';

const DOMAIN = 'inbox.example.test';
const accounts = [
	{ id: 'acc-1', name: 'Resend', status: InboxProviderAccountStatusEnum.ACTIVE, capabilities: { inbound: true } }
] as IInboxProviderAccount[];

const stored = (overrides: Partial<IInboxMailbox> = {}): IInboxMailbox =>
	({
		id: 'm1',
		address: `support.acme@${DOMAIN}`,
		displayName: 'Support',
		kind: InboxMailboxKindEnum.FORWARDING,
		ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
		purpose: InboxMailboxPurposeEnum.INBOX,
		senderAllowlist: [],
		isDefault: false,
		settings: { forwardFrom: 'me@acme.test' },
		...overrides
	}) as IInboxMailbox;

/** The mailbox dialogs: each saves by itself and closes with the API's answer. */
describe('mailbox dialogs', () => {
	const api = { createMailbox: jest.fn(), updateMailbox: jest.fn(), members: jest.fn(), setMembers: jest.fn() };
	const directory = { employees: jest.fn(), teams: jest.fn(), users: jest.fn(), everWorksAgents: jest.fn() };
	const dialogRef = { close: jest.fn() };

	function render<T>(type: new (...args: never[]) => T, context: Partial<T>) {
		TestBed.configureTestingModule({
			imports: [type],
			providers: [
				{ provide: InboxEmailSettingsService, useValue: api },
				{ provide: InboxDirectoryService, useValue: directory },
				{ provide: NbDialogRef, useValue: dialogRef }
			]
		});
		const fixture = TestBed.createComponent(type);
		Object.assign(fixture.componentInstance as object, {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			...context
		});
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance };
	}

	beforeEach(() => jest.resetAllMocks());

	describe('InboxMailboxCreateDialogComponent', () => {
		it('creates a team mailbox on the platform domain, reading the teams once', () => {
			directory.teams.mockReturnValue(of([{ id: 't1', name: 'Design' }]));
			const { component } = render(InboxMailboxCreateDialogComponent, { platformDomain: DOMAIN, accounts });
			component.setOwnerType(InboxMailboxOwnerTypeEnum.TEAM);
			component.setOwnerType(InboxMailboxOwnerTypeEnum.TEAM);
			expect(directory.teams).toHaveBeenCalledTimes(1);
			expect(component.teams()).toEqual([{ id: 't1', name: 'Design' }]);

			component.save();
			expect(api.createMailbox).not.toHaveBeenCalled();
			expect(component.shownErrors()).toHaveProperty('owner');

			api.createMailbox.mockReturnValue(of({ id: 'new', address: `design.acme@${DOMAIN}` }));
			component.patch({ ownerTeamId: 't1' });
			component.save();
			expect(api.createMailbox).toHaveBeenCalledWith({
				ownerType: InboxMailboxOwnerTypeEnum.TEAM,
				ownerTeamId: 't1',
				kind: InboxMailboxKindEnum.PLATFORM,
				organizationId: 'org-1'
			});
			expect(dialogRef.close).toHaveBeenCalledWith({ mailbox: { id: 'new', address: `design.acme@${DOMAIN}` } });
		});

		it('without a platform domain, starts on a custom domain; a list that cannot be read is said so', () => {
			directory.employees.mockReturnValue(throwError(() => ({ status: 403 })));
			const { component } = render(InboxMailboxCreateDialogComponent, { platformDomain: null, accounts });
			expect(component.form().kind).toBe(InboxMailboxKindEnum.CUSTOM_DOMAIN);
			expect(component.accountOptions().map((account) => account.id)).toEqual(['acc-1']);
			component.setOwnerType(InboxMailboxOwnerTypeEnum.EMPLOYEE);
			expect(component.employeesState()).toBe('error');
		});

		it('keeps everything typed and shows the API refusal', () => {
			api.createMailbox.mockReturnValue(
				throwError(() => ({ status: 409, error: { message: 'That address is already taken.' } }))
			);
			const { component } = render(InboxMailboxCreateDialogComponent, { platformDomain: DOMAIN, accounts });
			component.patch({ localPart: 'support' });
			component.save();
			expect(component.apiError()).toBe('That address is already taken.');
			expect(component.form().localPart).toBe('support');
			expect(dialogRef.close).not.toHaveBeenCalled();
		});
	});

	describe('InboxMailboxEditDialogComponent', () => {
		it('routes the mailbox to an Ever Works agent, keeping its other settings', () => {
			directory.everWorksAgents.mockReturnValue(of([{ id: 'agent-1', name: 'Support agent' }]));
			api.updateMailbox.mockReturnValue(of(stored()));
			const { component } = render(InboxMailboxEditDialogComponent, { mailbox: stored(), accounts });
			expect(directory.everWorksAgents).toHaveBeenCalledWith('org-1', 'tenant-1');
			expect(component.agentOptions()).toEqual([{ id: 'agent-1', name: 'Support agent' }]);
			component.patch({ everWorksAgentId: 'agent-1' });
			component.save();
			expect(api.updateMailbox).toHaveBeenCalledWith(
				'm1',
				{ settings: { forwardFrom: 'me@acme.test', [EVER_WORKS_AGENT_SETTING]: 'agent-1' } },
				'org-1'
			);
		});

		it('keeps a stored agent the list does not have selectable, and closes without a request when nothing changed', () => {
			directory.everWorksAgents.mockReturnValue(of([]));
			const mailbox = stored({ settings: { [EVER_WORKS_AGENT_SETTING]: 'ew-agent-id' } });
			const { component } = render(InboxMailboxEditDialogComponent, { mailbox, accounts });
			expect(component.agentOptions().map((agent) => agent.id)).toEqual(['ew-agent-id']);
			component.save();
			expect(api.updateMailbox).not.toHaveBeenCalled();
			expect(dialogRef.close).toHaveBeenCalledWith();
		});
	});

	describe('InboxMailboxMembersDialogComponent', () => {
		it('lists the users with their membership and replaces the members', () => {
			api.members.mockReturnValue(of([{ userId: 'u1', role: InboxMailboxMemberRoleEnum.MANAGER }]));
			directory.users.mockReturnValue(
				of([
					{ id: 'u1', name: 'Ada' },
					{ id: 'u2', name: 'Zoe' }
				])
			);
			api.setMembers.mockReturnValue(of([]));
			const { component } = render(InboxMailboxMembersDialogComponent, { mailbox: stored() });
			expect(component.view()).toBe('ready');
			expect(component.rows().map((row) => [row.user.id, row.member, row.role])).toEqual([
				['u1', true, InboxMailboxMemberRoleEnum.MANAGER],
				['u2', false, InboxMailboxMemberRoleEnum.READER]
			]);
			component.setMember(component.rows()[1], true);
			component.setMember(component.rows()[0], false);
			component.save();
			expect(api.setMembers).toHaveBeenCalledWith(
				'm1',
				[{ userId: 'u2', role: InboxMailboxMemberRoleEnum.READER }],
				'org-1'
			);
			expect(dialogRef.close).toHaveBeenCalledWith({ members: [] });
		});

		it('says so when the users cannot be listed', () => {
			api.members.mockReturnValue(of([]));
			directory.users.mockReturnValue(throwError(() => ({ status: 403 })));
			const { component } = render(InboxMailboxMembersDialogComponent, { mailbox: stored() });
			expect(component.view()).toBe('forbidden');
		});
	});
});
