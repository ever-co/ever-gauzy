import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbAlertModule, NbButtonModule, NbCheckboxModule, NbTabsetModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
	EverWorksAgentRow,
	EverWorksPeopleView,
	EverWorksProjectsView,
	EverWorksTeamsView,
	EverWorksUiService
} from '../../services/ever-works.service';
import { errorText, isNotFound } from '../shared/ever-works-ui.utils';

/** The choice of a row that creates the record on the other side instead of pairing it. */
export const CREATE = '__create__';

type Section = 'people' | 'agents' | 'teams' | 'projects';

/**
 * Match review of a mapping (plan 01 §3, §5, §10; plan 06 G-P1-6..8, G-P1-11): people, agents, teams and
 * projects ↔ works. Nothing is paired silently: a suggestion (a verified email, the same name or URL) is
 * preselected and the admin confirms it, pairs by hand, creates the record on the other side where the
 * mapping allows it, or removes a pairing. Used by the connect wizard and the settings page.
 */
@Component({
	selector: 'ngx-ever-works-match-review',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbAlertModule, NbButtonModule, NbCheckboxModule, NbTabsetModule, TranslatePipe],
	template: `
		<p>{{ 'EVER_WORKS.REVIEW.INTRO' | translate }}</p>
		<nb-tabset>
			<nb-tab [tabTitle]="'EVER_WORKS.REVIEW.PEOPLE' | translate" data-test="tab-people">
				@if (errors.people) {
					<nb-alert status="danger" role="alert" data-test="people-error">{{ errors.people }}</nb-alert>
				}
				@if (people) {
					@if (!people.members.length) {
						<p>{{ 'EVER_WORKS.REVIEW.EMPTY' | translate }}</p>
					} @else {
						<table class="table" data-test="people">
							<thead>
								<tr>
									<th>{{ 'EVER_WORKS.REVIEW.EVER_WORKS' | translate }}</th>
									<th>{{ 'EVER_WORKS.REVIEW.GAUZY' | translate }}</th>
									<th>{{ 'EVER_WORKS.REVIEW.STATE' | translate }}</th>
								</tr>
							</thead>
							<tbody>
								@for (row of people.members; track row.ewUserId) {
									<tr [attr.data-test]="'person-' + row.ewUserId">
										<td>
											<div>{{ row.displayName || row.username }}</div>
											<small>
												{{ row.email || '—' }}
												@if (row.emailVerified) {
													({{ 'EVER_WORKS.REVIEW.VERIFIED' | translate }})
												}
											</small>
										</td>
										<td>
											@if (row.linkedEmployeeId) {
												<button nbButton ghost size="tiny" type="button" data-test="unlink-person" [disabled]="busy.people" (click)="unlinkPerson(row.ewUserId)">
													{{ 'EVER_WORKS.REVIEW.UNLINK' | translate }}
												</button>
											} @else {
												<select class="form-control" [name]="'person-' + row.ewUserId" [(ngModel)]="personChoice[row.ewUserId]" [disabled]="busy.people">
													<option value="">{{ 'EVER_WORKS.REVIEW.NOT_PAIRED_OPTION' | translate }}</option>
													@for (employee of people.unmatchedEmployees; track employee.employeeId) {
														<option [value]="employee.employeeId">{{ employee.name }}{{ employee.email ? ' — ' + employee.email : '' }}</option>
													}
												</select>
											}
										</td>
										<td>{{ stateLabel(!!row.linkedEmployeeId, !!row.suggestion) | translate }}</td>
									</tr>
								}
							</tbody>
						</table>
						<div class="actions">
							<button nbButton ghost type="button" data-test="accept-people" [disabled]="busy.people" (click)="acceptPeople()">
								{{ 'EVER_WORKS.REVIEW.ACCEPT_ALL' | translate }}
							</button>
							<button nbButton status="primary" type="button" data-test="save-people" [disabled]="busy.people" (click)="savePeople()">
								{{ 'EVER_WORKS.COMMON.SAVE' | translate }}
							</button>
						</div>
					}
				}
			</nb-tab>
			<nb-tab [tabTitle]="'EVER_WORKS.REVIEW.AGENTS' | translate" data-test="tab-agents">
				<p>{{ 'EVER_WORKS.REVIEW.AGENTS_INTRO' | translate }}</p>
				@if (errors.agents) {
					<nb-alert status="danger" role="alert" data-test="agents-error">{{ errors.agents }}</nb-alert>
				}
				@if (!agents.length) {
					<p data-test="agents-empty">{{ 'EVER_WORKS.REVIEW.AGENTS_EMPTY' | translate }}</p>
				} @else {
					<table class="table" data-test="agents">
						<tbody>
							@for (agent of agents; track agent.ewAgentId) {
								<tr>
									<td>{{ agent.name || agent.ewAgentId }}</td>
									<td>{{ agent.status || '—' }}</td>
								</tr>
							}
						</tbody>
					</table>
				}
			</nb-tab>
			<nb-tab [tabTitle]="'EVER_WORKS.REVIEW.TEAMS' | translate" data-test="tab-teams">
				@if (errors.teams) {
					<nb-alert status="danger" role="alert" data-test="teams-error">{{ errors.teams }}</nb-alert>
				}
				@if (teams) {
					@if (!teams.teams.length && !teams.unmatchedTeams.length) {
						<p>{{ 'EVER_WORKS.REVIEW.EMPTY' | translate }}</p>
					} @else {
						<table class="table" data-test="teams">
							<tbody>
								@for (row of teams.teams; track row.ewTeamId) {
									<tr [attr.data-test]="'team-' + row.ewTeamId">
										<td [class.nested]="!!row.parentTeamId">{{ row.name }}</td>
										<td>
											@if (row.linkedTeamId) {
												<button nbButton ghost size="tiny" type="button" data-test="unlink-team" [disabled]="busy.teams" (click)="unlinkTeam(row.ewTeamId)">
													{{ 'EVER_WORKS.REVIEW.UNLINK' | translate }}
												</button>
											} @else {
												<select class="form-control" [name]="'team-' + row.ewTeamId" [(ngModel)]="teamChoice[row.ewTeamId]" [disabled]="busy.teams">
													<option value="">{{ 'EVER_WORKS.REVIEW.NOT_PAIRED_OPTION' | translate }}</option>
													<option [value]="create">{{ 'EVER_WORKS.REVIEW.CREATE_IN_GAUZY' | translate }}</option>
													@for (team of teams.unmatchedTeams; track team.teamId) {
														<option [value]="team.teamId">{{ team.name }}</option>
													}
												</select>
											}
										</td>
										<td>{{ stateLabel(!!row.linkedTeamId, !!row.suggestion) | translate }}</td>
									</tr>
								}
							</tbody>
						</table>
						@if (unpairedGauzyTeams().length) {
							<h6>{{ 'EVER_WORKS.REVIEW.UNMATCHED_GAUZY' | translate }}</h6>
							@for (team of unpairedGauzyTeams(); track team.teamId) {
								<div>
									<nb-checkbox
										[name]="'create-ew-' + team.teamId"
										[attr.data-test]="'create-ew-' + team.teamId"
										[(ngModel)]="createInEverWorks[team.teamId]"
										[disabled]="busy.teams"
									>
										{{ team.name }} — {{ 'EVER_WORKS.REVIEW.CREATE_IN_EVER_WORKS' | translate }}
									</nb-checkbox>
								</div>
							}
						}
						<div class="actions">
							<button nbButton ghost type="button" data-test="accept-teams" [disabled]="busy.teams" (click)="acceptTeams()">
								{{ 'EVER_WORKS.REVIEW.ACCEPT_ALL' | translate }}
							</button>
							<button nbButton status="primary" type="button" data-test="save-teams" [disabled]="busy.teams" (click)="saveTeams()">
								{{ 'EVER_WORKS.COMMON.SAVE' | translate }}
							</button>
						</div>
					}
				}
			</nb-tab>
			<nb-tab [tabTitle]="'EVER_WORKS.REVIEW.PROJECTS' | translate" data-test="tab-projects">
				@if (projectsUnavailable) {
					<p data-test="projects-unavailable">{{ 'EVER_WORKS.REVIEW.PROJECTS_UNAVAILABLE' | translate }}</p>
				}
				@if (errors.projects) {
					<nb-alert status="danger" role="alert" data-test="projects-error">{{ errors.projects }}</nb-alert>
				}
				@if (projects) {
					@if (!projects.works.length) {
						<p>{{ 'EVER_WORKS.REVIEW.EMPTY' | translate }}</p>
					} @else {
						<table class="table" data-test="projects">
							<tbody>
								@for (row of projects.works; track row.ewWorkId) {
									<tr [attr.data-test]="'work-' + row.ewWorkId">
										<td>
											<div>{{ row.name }}</div>
											@if (row.website) {
												<small>{{ row.website }}</small>
											}
										</td>
										<td>
											@if (row.linkedProjectId) {
												<button nbButton ghost size="tiny" type="button" data-test="unlink-work" [disabled]="busy.projects" (click)="unlinkWork(row.ewWorkId)">
													{{ 'EVER_WORKS.REVIEW.UNLINK' | translate }}
												</button>
											} @else {
												<select class="form-control" [name]="'work-' + row.ewWorkId" [(ngModel)]="workChoice[row.ewWorkId]" [disabled]="busy.projects">
													<option value="">{{ 'EVER_WORKS.REVIEW.NOT_PAIRED_OPTION' | translate }}</option>
													<option [value]="create">{{ 'EVER_WORKS.REVIEW.CREATE_IN_GAUZY' | translate }}</option>
													@for (project of projects.unmatchedProjects; track project.projectId) {
														<option [value]="project.projectId">{{ project.name }}</option>
													}
												</select>
											}
										</td>
										<td>{{ stateLabel(!!row.linkedProjectId, !!row.suggestion) | translate }}</td>
									</tr>
								}
							</tbody>
						</table>
						<div class="actions">
							<button nbButton ghost type="button" data-test="accept-projects" [disabled]="busy.projects" (click)="acceptProjects()">
								{{ 'EVER_WORKS.REVIEW.ACCEPT_ALL' | translate }}
							</button>
							<button nbButton status="primary" type="button" data-test="save-projects" [disabled]="busy.projects" (click)="saveProjects()">
								{{ 'EVER_WORKS.COMMON.SAVE' | translate }}
							</button>
						</div>
					}
				}
			</nb-tab>
		</nb-tabset>
	`,
	styles: [
		`
			.actions {
				display: flex;
				gap: 0.5rem;
				margin-top: 1rem;
			}
			.nested {
				padding-left: 1.5rem;
			}
		`
	]
})
export class EverWorksMatchReviewComponent implements OnChanges {
	private readonly api = inject(EverWorksUiService);
	private readonly cdr = inject(ChangeDetectorRef);

	@Input() organizationId: string | null = null;
	@Input() integrationTenantId: string | null = null;

	readonly create = CREATE;
	people: EverWorksPeopleView | null = null;
	agents: EverWorksAgentRow[] = [];
	teams: EverWorksTeamsView | null = null;
	projects: EverWorksProjectsView | null = null;
	projectsUnavailable = false;
	personChoice: Record<string, string> = {};
	teamChoice: Record<string, string> = {};
	workChoice: Record<string, string> = {};
	createInEverWorks: Record<string, boolean> = {};
	busy: Record<Section, boolean> = { people: false, agents: false, teams: false, projects: false };
	errors: Record<Section, string | null> = { people: null, agents: null, teams: null, projects: null };

	ngOnChanges(): void {
		if (!this.integrationTenantId) return;
		const id = this.integrationTenantId;
		this.run('people', this.api.people(this.organizationId, id), (view) => this.setPeople(view));
		this.run('agents', this.api.agents(this.organizationId, id), (rows) => (this.agents = rows ?? []));
		this.run('teams', this.api.teams(this.organizationId, id), (view) => this.setTeams(view));
		this.run('projects', this.api.projects(this.organizationId, id), (view) => this.setProjects(view));
	}

	stateLabel(linked: boolean, suggested: boolean): string {
		return linked ? 'EVER_WORKS.REVIEW.LINKED' : suggested ? 'EVER_WORKS.REVIEW.SUGGESTED' : 'EVER_WORKS.REVIEW.UNMATCHED';
	}

	/** Gauzy teams paired with nothing and not chosen for an Ever Works team in this form. */
	unpairedGauzyTeams(): Array<{ teamId: string; name: string }> {
		const chosen = new Set(Object.values(this.teamChoice));
		return (this.teams?.unmatchedTeams ?? []).filter((team) => !chosen.has(team.teamId));
	}

	// ── People ─────────────────────────────────────────────────────────────────────────────────────

	savePeople(): void {
		const links = (this.people?.members ?? [])
			.filter((row) => !row.linkedEmployeeId && this.personChoice[row.ewUserId])
			.map((row) => ({ ewUserId: row.ewUserId, employeeId: this.personChoice[row.ewUserId] }));
		if (!links.length) return;
		this.run('people', this.api.decidePeople(this.organizationId, this.id, { links }), (view) => this.setPeople(view));
	}

	acceptPeople(): void {
		this.run('people', this.api.decidePeople(this.organizationId, this.id, { acceptSuggestions: true }), (view) => this.setPeople(view));
	}

	unlinkPerson(ewUserId: string): void {
		this.run('people', this.api.decidePeople(this.organizationId, this.id, { unlinks: [ewUserId] }), (view) => this.setPeople(view));
	}

	// ── Teams ──────────────────────────────────────────────────────────────────────────────────────

	saveTeams(): void {
		const rows = (this.teams?.teams ?? []).filter((row) => !row.linkedTeamId && this.teamChoice[row.ewTeamId]);
		const links = rows.filter((row) => this.teamChoice[row.ewTeamId] !== CREATE).map((row) => ({ ewTeamId: row.ewTeamId, teamId: this.teamChoice[row.ewTeamId] }));
		const createInGauzy = rows.filter((row) => this.teamChoice[row.ewTeamId] === CREATE).map((row) => row.ewTeamId);
		const createInEverWorks = this.unpairedGauzyTeams()
			.filter((team) => this.createInEverWorks[team.teamId])
			.map((team) => team.teamId);
		if (!links.length && !createInGauzy.length && !createInEverWorks.length) return;
		this.run(
			'teams',
			this.api.decideTeams(this.organizationId, this.id, {
				...(links.length ? { links } : {}),
				...(createInGauzy.length ? { createInGauzy } : {}),
				...(createInEverWorks.length ? { createInEverWorks } : {})
			}),
			(view) => this.setTeams(view)
		);
	}

	acceptTeams(): void {
		this.run('teams', this.api.decideTeams(this.organizationId, this.id, { acceptSuggestions: true }), (view) => this.setTeams(view));
	}

	unlinkTeam(ewTeamId: string): void {
		this.run('teams', this.api.decideTeams(this.organizationId, this.id, { unlinks: [ewTeamId] }), (view) => this.setTeams(view));
	}

	// ── Projects ───────────────────────────────────────────────────────────────────────────────────

	saveProjects(): void {
		const rows = (this.projects?.works ?? []).filter((row) => !row.linkedProjectId && this.workChoice[row.ewWorkId]);
		const links = rows.filter((row) => this.workChoice[row.ewWorkId] !== CREATE).map((row) => ({ ewWorkId: row.ewWorkId, projectId: this.workChoice[row.ewWorkId] }));
		const createInGauzy = rows.filter((row) => this.workChoice[row.ewWorkId] === CREATE).map((row) => row.ewWorkId);
		if (!links.length && !createInGauzy.length) return;
		this.run(
			'projects',
			this.api.decideProjects(this.organizationId, this.id, { ...(links.length ? { links } : {}), ...(createInGauzy.length ? { createInGauzy } : {}) }),
			(view) => this.setProjects(view)
		);
	}

	acceptProjects(): void {
		this.run('projects', this.api.decideProjects(this.organizationId, this.id, { acceptSuggestions: true }), (view) => this.setProjects(view));
	}

	unlinkWork(ewWorkId: string): void {
		this.run('projects', this.api.decideProjects(this.organizationId, this.id, { unlinks: [ewWorkId] }), (view) => this.setProjects(view));
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private get id(): string {
		return this.integrationTenantId as string;
	}

	private setPeople(view: EverWorksPeopleView): void {
		this.people = view;
		// A suggestion is preselected; nothing is paired until the admin saves.
		this.personChoice = Object.fromEntries(view.members.filter((row) => !row.linkedEmployeeId).map((row) => [row.ewUserId, row.suggestion?.employeeId ?? '']));
	}

	private setTeams(view: EverWorksTeamsView): void {
		this.teams = view;
		this.teamChoice = Object.fromEntries(view.teams.filter((row) => !row.linkedTeamId).map((row) => [row.ewTeamId, row.suggestion?.teamId ?? '']));
		this.createInEverWorks = {};
	}

	private setProjects(view: EverWorksProjectsView): void {
		this.projects = view;
		this.projectsUnavailable = false;
		this.workChoice = Object.fromEntries(view.works.filter((row) => !row.linkedProjectId).map((row) => [row.ewWorkId, row.suggestion?.projectId ?? '']));
	}

	private run<T>(section: Section, request: Observable<T>, apply: (value: T) => void): void {
		this.busy[section] = true;
		this.errors[section] = null;
		this.cdr.markForCheck();
		request.subscribe({
			next: (value) => {
				this.busy[section] = false;
				apply(value);
				this.cdr.markForCheck();
			},
			error: (error) => {
				this.busy[section] = false;
				if (section === 'projects' && isNotFound(error) && !this.projects) {
					// The projects tab (G-P1-8) is not part of this installation's API yet.
					this.projectsUnavailable = true;
				} else {
					this.errors[section] = errorText(error);
				}
				this.cdr.markForCheck();
			}
		});
	}
}
