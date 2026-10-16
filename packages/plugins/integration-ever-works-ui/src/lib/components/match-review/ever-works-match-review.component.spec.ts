import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EverWorksUiService } from '../../services/ever-works.service';
import { CREATE, EverWorksMatchReviewComponent } from './ever-works-match-review.component';

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
});
