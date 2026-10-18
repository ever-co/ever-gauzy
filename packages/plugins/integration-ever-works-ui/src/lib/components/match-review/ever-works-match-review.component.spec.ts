import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { EverWorksUiService } from '../../services/ever-works.service';
import { CREATE, DRAFT_INITIATIVE, EverWorksMatchReviewComponent, preselect } from './ever-works-match-review.component';

const PEOPLE = {
	members: [
		{
			ewUserId: 'u1',
			username: 'ann',
			displayName: 'Ann',
			email: 'ann@example.com',
			emailVerified: true,
			role: 'member',
			isActive: true,
			linkedEmployeeId: null,
			suggestion: { employeeId: 'e1', reason: 'verified_email' as const }
		},
		{ ewUserId: 'u2', username: 'bob', displayName: null, email: null, emailVerified: false, role: 'member', isActive: true, linkedEmployeeId: 'e9', suggestion: null },
		{ ewUserId: 'u3', username: 'cy', displayName: null, email: null, emailVerified: false, role: 'member', isActive: true, linkedEmployeeId: null, suggestion: null }
	],
	unmatchedEmployees: [
		{ employeeId: 'e1', name: 'Ann G', email: 'ann@example.com' },
		{ employeeId: 'e2', name: 'Cy G', email: null }
	]
};

/** The People tab with the invite actions and match sources (G-P1-6). */
const PEOPLE_INVITES = {
	members: [
		{ ...PEOPLE.members[0] },
		{ ...PEOPLE.members[1], matchedBy: 'ever_id' as const },
		{ ...PEOPLE.members[2] },
		{ ewUserId: 'u4', username: 'dee', displayName: 'Dee', email: 'dee@example.com', emailVerified: true, role: 'member', isActive: true, linkedEmployeeId: null, suggestion: null, gauzyInvite: null },
		{
			ewUserId: 'u5',
			username: 'eve',
			displayName: 'Eve',
			email: 'eve@example.com',
			emailVerified: true,
			role: 'member',
			isActive: true,
			linkedEmployeeId: null,
			suggestion: null,
			gauzyInvite: { inviteId: 'inv-5', expireDate: '2026-10-25T00:00:00.000Z' }
		},
		{ ewUserId: 'u6', username: 'fay', displayName: 'Fay', email: 'fay@example.com', emailVerified: false, role: 'member', isActive: true, linkedEmployeeId: null, suggestion: null },
		{ ewUserId: 'u7', username: 'gus', displayName: 'Gus', email: 'gus@example.com', emailVerified: true, role: 'member', isActive: true, linkedEmployeeId: 'e7', suggestion: null, matchedBy: 'verified_email' as const },
		{ ewUserId: 'u8', username: 'hal', displayName: 'Hal', email: 'hal@example.com', emailVerified: true, role: 'member', isActive: true, linkedEmployeeId: 'e8', suggestion: null, matchedBy: 'manual' as const },
		{ ewUserId: 'u9', username: 'ivy', displayName: 'Ivy', email: 'ivy@example.com', emailVerified: true, role: 'member', isActive: true, linkedEmployeeId: null, suggestion: { employeeId: 'e9', reason: 'ever_id' as const } }
	],
	unmatchedEmployees: [
		{ employeeId: 'e1', name: 'Ann G', email: 'ann@example.com' },
		{ employeeId: 'e2', name: 'Cy G', email: null },
		{ employeeId: 'e3', name: 'Zoe G', email: 'zoe@example.com' },
		{ employeeId: 'e9', name: 'Ivy G', email: 'ivy@example.com' }
	]
};

const TEAMS = {
	teams: [
		{ ewTeamId: 't1', name: 'Platform', slug: null, parentTeamId: null, linkedTeamId: null, suggestion: { teamId: 'g1', reason: 'same_name' as const } },
		{ ewTeamId: 't2', name: 'Design', slug: null, parentTeamId: null, linkedTeamId: null, suggestion: null }
	],
	unmatchedTeams: [
		{ teamId: 'g1', name: 'Platform' },
		{ teamId: 'g2', name: 'Sales' }
	]
};

const INITIATIVES = {
	missions: [
		{ ewMissionId: 'm-1', title: 'Grow the community', status: 'active', linkedInitiativeId: null, suggestion: { initiativeId: 'i1', reason: 'same_title' as const } },
		{ ewMissionId: 'm-2', title: 'Launch the docs', status: 'paused', linkedInitiativeId: null, suggestion: null },
		{ ewMissionId: 'm-3', title: 'Ship v2', status: 'active', linkedInitiativeId: 'i9', suggestion: null }
	],
	unmatchedInitiatives: [
		{ initiativeId: 'i1', title: 'Grow the community', state: 'active' },
		{ initiativeId: 'i2', title: 'Hire a designer', state: 'active' },
		{ initiativeId: 'i3', title: 'Plan the offsite', state: DRAFT_INITIATIVE }
	]
};

/** Match review: suggestions are preselected, nothing is paired until saved, creates are explicit. */
describe('EverWorksMatchReviewComponent', () => {
	const api = {
		people: jest.fn(),
		agents: jest.fn(),
		teams: jest.fn(),
		projects: jest.fn(),
		initiatives: jest.fn(),
		decidePeople: jest.fn(),
		inviteToGauzy: jest.fn(),
		inviteToEverWorks: jest.fn(),
		decideTeams: jest.fn(),
		decideProjects: jest.fn(),
		decideInitiatives: jest.fn()
	};

	function render() {
		TestBed.configureTestingModule({ imports: [EverWorksMatchReviewComponent], providers: [{ provide: EverWorksUiService, useValue: api }] });
		const fixture = TestBed.createComponent(EverWorksMatchReviewComponent);
		Object.assign(fixture.componentInstance, { organizationId: 'org-1', integrationTenantId: 'm1' });
		fixture.componentInstance.ngOnChanges();
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.people.mockReturnValue(of(PEOPLE));
		api.agents.mockReturnValue(of([{ ewAgentId: 'a1', employeeId: 'e5', name: 'Builder', status: 'idle', isActive: true }]));
		api.teams.mockReturnValue(of(TEAMS));
		api.projects.mockReturnValue(of({ works: [], unmatchedProjects: [] }));
		api.initiatives.mockReturnValue(of(INITIATIVES));
	});

	it('preselects suggestions and sends only the pairs chosen for unpaired members', () => {
		api.decidePeople.mockReturnValue(of(PEOPLE));
		const { component } = render();
		expect(component.personChoice).toEqual({ u1: 'e1', u3: '' });
		component.personChoice['u3'] = 'e2';
		component.savePeople();
		expect(api.decidePeople).toHaveBeenCalledWith('org-1', 'm1', {
			links: [
				{ ewUserId: 'u1', employeeId: 'e1' },
				{ ewUserId: 'u3', employeeId: 'e2' }
			]
		});
	});

	it('accept-all and removing a pairing go to the API as such', () => {
		api.decidePeople.mockReturnValue(of(PEOPLE));
		const { component } = render();
		component.acceptPeople();
		expect(api.decidePeople).toHaveBeenLastCalledWith('org-1', 'm1', { acceptSuggestions: true });
		component.unlinkPerson('u2');
		expect(api.decidePeople).toHaveBeenLastCalledWith('org-1', 'm1', { unlinks: ['u2'] });
	});

	it('teams: pairs, creates in Gauzy and creates in Ever Works are explicit choices', () => {
		api.decideTeams.mockReturnValue(of(TEAMS));
		const { component } = render();
		expect(component.teamChoice).toEqual({ t1: 'g1', t2: '' });
		// A Gauzy team chosen for an Ever Works team is not offered for "create in Ever Works".
		expect(component.unpairedGauzyTeams().map((team) => team.teamId)).toEqual(['g2']);
		component.teamChoice['t2'] = CREATE;
		component.createInEverWorks['g2'] = true;
		component.saveTeams();
		expect(api.decideTeams).toHaveBeenCalledWith('org-1', 'm1', { links: [{ ewTeamId: 't1', teamId: 'g1' }], createInGauzy: ['t2'], createInEverWorks: ['g2'] });
	});

	it('lists the inbox items waiting for an unpaired member, by name (or id once they left)', () => {
		api.people.mockReturnValue(
			of({
				...PEOPLE,
				deferredInbox: [
					{ ewUserId: 'u3', count: 2, items: [{ ewItemId: 'i1', title: 'Approve the deploy?', kind: 'approval', occurredAt: null }] },
					{ ewUserId: 'u-gone', count: 1, items: [{ ewItemId: 'i2', title: '', kind: null, occurredAt: null }] }
				]
			})
		);
		const { el } = render();
		const block = el.querySelector('[data-test="deferred-inbox"]');
		expect(block?.querySelector('[data-test="deferred-u3"]')?.textContent).toContain('cy');
		expect(block?.querySelector('[data-test="deferred-u3"]')?.textContent).toContain('Approve the deploy?');
		expect(block?.querySelector('[data-test="deferred-u-gone"]')?.textContent).toContain('u-gone');
		expect(block?.querySelector('[data-test="deferred-u-gone"]')?.textContent).toContain('i2');
	});

	// Its own test: a TestBed reset inside a test also drops the app-wide defaults (jest.angular-defaults.ts:
	// the translate service, Nebular's forRoot modules) that a top-level beforeEach adds once per test.
	it('lists nothing when no inbox item waits', () => {
		expect(render().el.querySelector('[data-test="deferred-inbox"]')).toBeNull();
	});

	it('an API refusal is shown on its tab', () => {
		api.decideTeams.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'The mapping is disabled; enable it before creating teams.' } })));
		const { component, fixture, el } = render();
		component.teamChoice['t2'] = CREATE;
		component.saveTeams();
		fixture.detectChanges();
		expect(el.querySelector('[data-test="teams-error"]')?.textContent).toContain('mapping is disabled');
	});

	it('an installation without the projects routes says so instead of an error', () => {
		api.projects.mockReturnValue(throwError(() => ({ status: 404, error: { message: 'Cannot GET' } })));
		const { component, fixture, el } = render();
		fixture.detectChanges();
		expect(component.projectsUnavailable).toBe(true);
		expect(component.errors.projects).toBeNull();
		expect(el.querySelector('[data-test="projects-unavailable"]')).not.toBeNull();
	});

	it('a pairing removed here is not preselected again (saving another row does not undo it)', () => {
		const unpaired = { ...TEAMS, teams: [{ ...TEAMS.teams[0] }, TEAMS.teams[1]] };
		api.decideTeams.mockReturnValue(of(unpaired));
		const { component } = render();
		component.unlinkTeam('t1');
		// The view after the removal suggests the same pair again; it stays unselected.
		expect(component.teamChoice['t1']).toBe('');
		component.teamChoice['t2'] = 'g2';
		component.saveTeams();
		expect(api.decideTeams).toHaveBeenLastCalledWith('org-1', 'm1', { links: [{ ewTeamId: 't2', teamId: 'g2' }] });
	});

	it('a Gauzy record suggested for several rows is not preselected, and choosing it twice is refused', () => {
		api.teams.mockReturnValue(
			of({
				teams: [
					{ ewTeamId: 't1', name: 'Platform', slug: null, parentTeamId: null, linkedTeamId: null, suggestion: { teamId: 'g1', reason: 'same_name' } },
					{ ewTeamId: 't3', name: 'Platform', slug: null, parentTeamId: 't9', linkedTeamId: null, suggestion: { teamId: 'g1', reason: 'same_name' } }
				],
				unmatchedTeams: [{ teamId: 'g1', name: 'Platform' }]
			})
		);
		const { component } = render();
		expect(component.teamChoice).toEqual({ t1: '', t3: '' });
		component.teamChoice['t1'] = 'g1';
		component.teamChoice['t3'] = 'g1';
		component.saveTeams();
		expect(api.decideTeams).not.toHaveBeenCalled();
		expect(component.errors.teams).toBe('EVER_WORKS.REVIEW.DUPLICATE_CHOICE');
	});

	it('preselect: suggestions once, never a removed pairing nor an ambiguous one', () => {
		expect(
			preselect(
				[
					{ id: 'a', suggested: 'x' },
					{ id: 'b', suggested: 'y' },
					{ id: 'c', suggested: 'y' },
					{ id: 'd', suggested: 'z' },
					{ id: 'e', suggested: null }
				],
				new Set(['d'])
			)
		).toEqual({ a: 'x', b: '', c: '', d: '', e: '' });
	});

	describe('initiatives ↔ missions (G-P2-2)', () => {
		it('preselects the same-title initiative and sends pairs, creates in Gauzy and paused creates in Ever Works', () => {
			api.decideInitiatives.mockReturnValue(of(INITIATIVES));
			const { component } = render();
			expect(api.initiatives).toHaveBeenCalledWith('org-1', 'm1');
			// The paired mission keeps its pairing; the suggestion is preselected, nothing is saved yet.
			expect(component.missionChoice).toEqual({ 'm-1': 'i1', 'm-2': '' });
			expect(api.decideInitiatives).not.toHaveBeenCalled();
			component.missionChoice['m-2'] = CREATE;
			// i1 is chosen for m-1, so only the others are offered for Ever Works.
			expect(component.unpairedGauzyInitiatives().map((row) => row.initiativeId)).toEqual(['i2', 'i3']);
			component.createMissionInEverWorks['i2'] = true;
			component.createMissionInEverWorks['i3'] = true;
			component.saveInitiatives();
			expect(api.decideInitiatives).toHaveBeenCalledWith('org-1', 'm1', {
				links: [{ ewMissionId: 'm-1', initiativeId: 'i1' }],
				createInGauzy: ['m-2'],
				// The draft is never sent: it goes to Ever Works once it is active.
				createInEverWorks: ['i2']
			});
		});

		it('accepts every suggestion, removes a pairing without suggesting it again, and refuses a double choice', () => {
			// Accepting pairs m-1 with i1; removing that pairing makes m-1 unpaired again (with its suggestion).
			const paired = {
				missions: INITIATIVES.missions.map((row) => (row.ewMissionId === 'm-1' ? { ...row, linkedInitiativeId: 'i1', suggestion: null } : row)),
				unmatchedInitiatives: INITIATIVES.unmatchedInitiatives.filter((row) => row.initiativeId !== 'i1')
			};
			api.decideInitiatives.mockReturnValueOnce(of(paired)).mockReturnValueOnce(of(INITIATIVES));
			const { component } = render();
			component.acceptInitiatives();
			expect(api.decideInitiatives).toHaveBeenLastCalledWith('org-1', 'm1', { acceptSuggestions: true });
			expect(component.missionChoice).toEqual({ 'm-2': '' });
			component.unlinkMission('m-1');
			expect(api.decideInitiatives).toHaveBeenLastCalledWith('org-1', 'm1', { unlinks: ['m-1'] });
			// The removed pairing's suggestion is not preselected again.
			expect(component.missionChoice['m-1']).toBe('');
			api.decideInitiatives.mockClear();
			component.missionChoice['m-1'] = 'i2';
			component.missionChoice['m-2'] = 'i2';
			component.saveInitiatives();
			expect(api.decideInitiatives).not.toHaveBeenCalled();
			expect(component.errors.initiatives).toBe('EVER_WORKS.REVIEW.DUPLICATE_CHOICE');
		});

		it('offers only the creates the mapping allows, and never sends one it does not', () => {
			api.decideInitiatives.mockReturnValue(of(INITIATIVES));
			const { component, fixture } = render();
			// New mappings sync missions one way (Ever Works → Gauzy): no mission is created from Gauzy.
			component.mapping = { isEnabled: true, directions: { missions: 'ew_to_gauzy' } } as never;
			component.ngOnChanges({ mapping: new SimpleChange(null, component.mapping, false) });
			fixture.detectChanges();
			expect(api.initiatives).toHaveBeenCalledTimes(1);
			expect(component.canCreateInitiatives).toBe(true);
			expect(component.canCreateMissions).toBe(false);
			component.missionChoice['m-2'] = CREATE;
			component.createMissionInEverWorks['i2'] = true;
			component.saveInitiatives();
			expect(api.decideInitiatives).toHaveBeenCalledWith('org-1', 'm1', { links: [{ ewMissionId: 'm-1', initiativeId: 'i1' }], createInGauzy: ['m-2'] });
			// A mapping that is off creates nothing on either side.
			component.mapping = { isEnabled: false, directions: { missions: 'both' } } as never;
			expect(component.canCreateInitiatives).toBe(false);
			expect(component.canCreateMissions).toBe(false);
			component.mapping = { isEnabled: true, directions: { missions: 'both' } } as never;
			expect(component.canCreateMissions).toBe(true);
		});

		it('keeps the choices of the other missions when one pairing is removed', () => {
			api.decideInitiatives.mockReturnValue(of(INITIATIVES));
			const { component } = render();
			// The admin turned the suggestion of m-1 down and chose to create m-2 in Gauzy, then removes m-3's pairing.
			component.missionChoice['m-1'] = '';
			component.missionChoice['m-2'] = CREATE;
			component.createMissionInEverWorks['i2'] = true;
			component.unlinkMission('m-3');
			expect(component.missionChoice).toEqual({ 'm-1': '', 'm-2': CREATE });
			expect(component.createMissionInEverWorks).toEqual({ i2: true });
		});

		it('drops the previous mapping\u2019s initiatives when the mapping changes', () => {
			const { component } = render();
			expect(component.initiatives).not.toBeNull();
			api.initiatives.mockReturnValue(throwError(() => ({ status: 404 })));
			component.integrationTenantId = 'm2';
			component.ngOnChanges({ integrationTenantId: new SimpleChange('m1', 'm2', false) });
			expect(component.initiatives).toBeNull();
			expect(component.missionChoice).toEqual({});
			expect(component.initiativesUnavailable).toBe(true);
		});

		it('does not preselect a suggestion when another free initiative has the same title', () => {
			api.initiatives.mockReturnValue(
				of({
					missions: [INITIATIVES.missions[0]],
					unmatchedInitiatives: [...INITIATIVES.unmatchedInitiatives, { initiativeId: 'i4', title: ' grow the COMMUNITY ', state: 'active' }]
				})
			);
			const { component } = render();
			expect(component.missionChoice).toEqual({ 'm-1': '' });
		});

		it('says the tab is not available when the API has no initiatives route yet', () => {
			api.initiatives.mockReturnValue(throwError(() => ({ status: 404 })));
			const { component } = render();
			expect(component.initiativesUnavailable).toBe(true);
			expect(component.errors.initiatives).toBeNull();
		});
	});

	describe('People: invite actions and match sources', () => {
		const text = (el: HTMLElement, selector: string) => el.querySelector(selector)?.textContent?.trim() ?? null;

		beforeEach(() => api.people.mockReturnValue(of(PEOPLE_INVITES)));

		it('shows how each pairing was made, and why a member is suggested', () => {
			const { el } = render();
			expect(text(el, '[data-test="match-source-u2"]')).toContain('EVER_WORKS.REVIEW.MATCHED_BY.ever_id');
			expect(text(el, '[data-test="match-source-u7"]')).toContain('EVER_WORKS.REVIEW.MATCHED_BY.verified_email');
			expect(text(el, '[data-test="match-source-u8"]')).toContain('EVER_WORKS.REVIEW.MATCHED_BY.manual');
			expect(text(el, '[data-test="suggestion-reason-u1"]')).toContain('EVER_WORKS.REVIEW.MATCHED_BY.verified_email');
			expect(text(el, '[data-test="suggestion-reason-u9"]')).toContain('EVER_WORKS.REVIEW.MATCHED_BY.ever_id');
			// An older API sends no source: a pairing then shows none.
			expect(el.querySelector('[data-test="match-source-u1"]')).toBeNull();
		});

		it('offers "invite to Gauzy" only for an unpaired, verified member with no Gauzy person and no pending invitation', () => {
			const { el } = render();
			const offered = Array.from(el.querySelectorAll('[data-test^="invite-gauzy-"]')).map((button) => button.getAttribute('data-test'));
			expect(offered).toEqual(['invite-gauzy-u4']);
			expect(el.querySelector('[data-test="gauzy-invite-pending-u5"]')).not.toBeNull();
		});

		it('asks before inviting to Gauzy, then invites with the Employee role and reloads the tab', () => {
			api.inviteToGauzy.mockReturnValue(of({ status: 'invited', inviteId: 'inv-4', email: 'dee@example.com', roleId: 'r-employee', expireDate: null }));
			const { component, fixture, el } = render();
			(el.querySelector('[data-test="invite-gauzy-u4"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			const dialog = el.querySelector('[data-test="invite-confirm"]');
			expect(dialog?.getAttribute('role')).toBe('dialog');
			expect(dialog?.textContent).toContain('dee@example.com');
			expect(dialog?.textContent).toContain('EVER_WORKS.REVIEW.INVITE.ROLE_EMPLOYEE');
			expect(api.inviteToGauzy).not.toHaveBeenCalled();

			(el.querySelector('[data-test="invite-confirm-yes"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(api.inviteToGauzy).toHaveBeenCalledWith('org-1', 'm1', { ewUserId: 'u4' });
			expect(api.people).toHaveBeenCalledTimes(2);
			expect(component.inviteResults['gauzy:u4']).toBe('EVER_WORKS.REVIEW.INVITE.RESULT.invited');
			expect(el.querySelector('[data-test="invite-confirm"]')).toBeNull();
		});

		it('cancelling the confirmation invites nobody', () => {
			const { fixture, el } = render();
			(el.querySelector('[data-test="invite-gauzy-u4"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			(el.querySelector('[data-test="invite-confirm-no"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(el.querySelector('[data-test="invite-confirm"]')).toBeNull();
			expect(api.inviteToGauzy).not.toHaveBeenCalled();
		});

		it('offers "invite to Ever Works" for a Gauzy person with an e-mail that no member is suggested for or chosen for', () => {
			const { component, fixture, el } = render();
			const offered = () => Array.from(el.querySelectorAll('[data-test^="invite-ew-"]')).map((button) => button.getAttribute('data-test'));
			// e1 is suggested for u1, e9 for u9 (Ever ID), e2 has no e-mail.
			expect(offered()).toEqual(['invite-ew-e3']);
			component.personChoice['u4'] = 'e3';
			fixture.detectChanges();
			expect(offered()).toEqual([]);
		});

		it('asks before inviting to Ever Works, then shows what Ever Works did', () => {
			api.inviteToEverWorks.mockReturnValue(of({ status: 'already_member', email: 'zoe@example.com', invitationId: null, expiresAt: null, ewUserId: 'u-zoe' }));
			const { component, fixture, el } = render();
			(el.querySelector('[data-test="invite-ew-e3"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(el.querySelector('[data-test="invite-confirm"]')?.textContent).toContain('zoe@example.com');
			expect(el.querySelector('[data-test="invite-confirm"]')?.textContent).toContain('EVER_WORKS.REVIEW.INVITE.ROLE_MEMBER');
			(el.querySelector('[data-test="invite-confirm-yes"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(api.inviteToEverWorks).toHaveBeenCalledWith('org-1', 'm1', { employeeId: 'e3' });
			expect(component.inviteResults['ew:e3']).toBe('EVER_WORKS.REVIEW.INVITE.RESULT.already_member');
			expect(api.people).toHaveBeenCalledTimes(2);
		});

		it('an invite refusal is shown on the People tab and nothing is reloaded', () => {
			api.inviteToGauzy.mockReturnValue(throwError(() => ({ status: 403, error: { message: 'Inviting people to Gauzy needs the permission to edit invites.' } })));
			const { component, fixture, el } = render();
			component.askInviteToGauzy(PEOPLE_INVITES.members[3]);
			component.confirmInvite();
			fixture.detectChanges();
			expect(text(el, '[data-test="people-error"]')).toContain('permission to edit invites');
			expect(api.people).toHaveBeenCalledTimes(1);
		});
	});

	it('a late answer for a previous mapping is dropped', () => {
		const late = new Subject<typeof PEOPLE>();
		api.people.mockReturnValueOnce(late);
		const { component } = render();
		component.integrationTenantId = 'm2';
		component.ngOnChanges();
		late.next({ ...PEOPLE, members: [] });
		expect(api.people).toHaveBeenLastCalledWith('org-1', 'm2');
		expect(component.people?.members).toHaveLength(3);
	});
});
