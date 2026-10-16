import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { EverWorksUiService } from '../../services/ever-works.service';
import { CREATE, EverWorksMatchReviewComponent, preselect } from './ever-works-match-review.component';

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

/** Match review: suggestions are preselected, nothing is paired until saved, creates are explicit. */
describe('EverWorksMatchReviewComponent', () => {
	const api = {
		people: jest.fn(),
		agents: jest.fn(),
		teams: jest.fn(),
		projects: jest.fn(),
		decidePeople: jest.fn(),
		decideTeams: jest.fn(),
		decideProjects: jest.fn()
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
