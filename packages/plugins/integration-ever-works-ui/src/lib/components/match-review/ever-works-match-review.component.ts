import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnChanges, type SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbAlertModule, NbButtonModule, NbCheckboxModule, NbTabsetModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	EverWorksAgentRow,
	EverWorksInitiativesView,
	EverWorksPeopleView,
	EverWorksProjectsView,
	EverWorksTeamsView,
	EverWorksUiService
} from '../../services/ever-works.service';
import type { EverWorksMapping } from '../../services/ever-works.service';
import { errorText, isNotFound } from '../shared/ever-works-ui.utils';

/** The choice of a row that creates the record on the other side instead of pairing it. */
export const CREATE = '__create__';

/**
 * The preselected choice of each unpaired row: its suggestion, unless the admin removed that pairing here,
 * or the same Gauzy record is suggested for several rows (same names: which one is meant is the admin's
 * call, as the API's "accept every suggestion" also leaves it).
 */
export function preselect(rows: ReadonlyArray<{ id: string; suggested: string | null }>, removed: ReadonlySet<string>): Record<string, string> {
	const times = new Map<string, number>();
	for (const row of rows) if (row.suggested) times.set(row.suggested, (times.get(row.suggested) ?? 0) + 1);
	return Object.fromEntries(rows.map((row) => [row.id, row.suggested && !removed.has(row.id) && times.get(row.suggested) === 1 ? row.suggested : '']));
}

type Section = 'people' | 'agents' | 'teams' | 'projects' | 'initiatives';

/** A Gauzy initiative in this state goes to Ever Works only once it is active (the API refuses a draft). */
export const DRAFT_INITIATIVE = 'draft';

/**
 * Match review of a mapping (plan 01 §3, §5, §9, §10; plan 06 G-P1-6..8, G-P1-11, G-P2-2): people, agents,
 * teams, projects ↔ works and initiatives ↔ missions. Nothing is paired silently: a suggestion (a verified email, the same name or URL) is
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
			<nb-tab [lazyLoad]="true" [tabTitle]="'EVER_WORKS.REVIEW.PEOPLE' | translate" data-test="tab-people">
				@if (errors.people) {
					<nb-alert status="danger" role="alert" data-test="people-error">{{ errors.people | translate }}</nb-alert>
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
					@if (people.deferredInbox?.length) {
						<div class="deferred-inbox" data-test="deferred-inbox">
							<h6>{{ 'EVER_WORKS.REVIEW.DEFERRED_INBOX' | translate }}</h6>
							<p>{{ 'EVER_WORKS.REVIEW.DEFERRED_INBOX_HINT' | translate }}</p>
							<ul>
								@for (row of people.deferredInbox; track row.ewUserId) {
									<li [attr.data-test]="'deferred-' + row.ewUserId">
										<strong>{{ memberName(row.ewUserId) }}</strong>:
										{{ 'EVER_WORKS.REVIEW.DEFERRED_COUNT' | translate: { count: row.count } }}
										<ul>
											@for (item of row.items; track item.ewItemId) {
												<li>{{ item.title || item.ewItemId }}</li>
											}
										</ul>
									</li>
								}
							</ul>
						</div>
					}
				}
			</nb-tab>
			<nb-tab [lazyLoad]="true" [tabTitle]="'EVER_WORKS.REVIEW.AGENTS' | translate" data-test="tab-agents">
				<p>{{ 'EVER_WORKS.REVIEW.AGENTS_INTRO' | translate }}</p>
				@if (errors.agents) {
					<nb-alert status="danger" role="alert" data-test="agents-error">{{ errors.agents | translate }}</nb-alert>
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
			<nb-tab [lazyLoad]="true" [tabTitle]="'EVER_WORKS.REVIEW.TEAMS' | translate" data-test="tab-teams">
				@if (errors.teams) {
					<nb-alert status="danger" role="alert" data-test="teams-error">{{ errors.teams | translate }}</nb-alert>
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
			<nb-tab [lazyLoad]="true" [tabTitle]="'EVER_WORKS.REVIEW.PROJECTS' | translate" data-test="tab-projects">
				@if (projectsUnavailable) {
					<p data-test="projects-unavailable">{{ 'EVER_WORKS.REVIEW.PROJECTS_UNAVAILABLE' | translate }}</p>
				}
				@if (errors.projects) {
					<nb-alert status="danger" role="alert" data-test="projects-error">{{ errors.projects | translate }}</nb-alert>
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
			<nb-tab [lazyLoad]="true" [tabTitle]="'EVER_WORKS.REVIEW.INITIATIVES' | translate" data-test="tab-initiatives">
				<p>{{ 'EVER_WORKS.REVIEW.INITIATIVES_INTRO' | translate }}</p>
				@if (initiativesUnavailable) {
					<p data-test="initiatives-unavailable">{{ 'EVER_WORKS.REVIEW.INITIATIVES_UNAVAILABLE' | translate }}</p>
				}
				@if (errors.initiatives) {
					<nb-alert status="danger" role="alert" data-test="initiatives-error">{{ errors.initiatives | translate }}</nb-alert>
				}
				@if (initiatives) {
					@if (!initiatives.missions.length && !initiatives.unmatchedInitiatives.length) {
						<p>{{ 'EVER_WORKS.REVIEW.EMPTY' | translate }}</p>
					} @else {
						@if (initiatives.missions.length) {
							<table class="table" data-test="initiatives">
								<tbody>
									@for (row of initiatives.missions; track row.ewMissionId) {
										<tr [attr.data-test]="'mission-' + row.ewMissionId">
											<td>
												<div>{{ row.title }}</div>
												@if (row.status) {
													<small>{{ row.status }}</small>
												}
											</td>
											<td>
												@if (row.linkedInitiativeId) {
													<button nbButton ghost size="tiny" type="button" data-test="unlink-mission" [disabled]="busy.initiatives" (click)="unlinkMission(row.ewMissionId)">
														{{ 'EVER_WORKS.REVIEW.UNLINK' | translate }}
													</button>
												} @else {
													<select class="form-control" [name]="'mission-' + row.ewMissionId" [(ngModel)]="missionChoice[row.ewMissionId]" [disabled]="busy.initiatives">
														<option value="">{{ 'EVER_WORKS.REVIEW.NOT_PAIRED_OPTION' | translate }}</option>
														@if (canCreateInitiatives) {
															<option [value]="create">{{ 'EVER_WORKS.REVIEW.CREATE_IN_GAUZY' | translate }}</option>
														}
														@for (initiative of initiatives.unmatchedInitiatives; track initiative.initiativeId) {
															<option [value]="initiative.initiativeId">{{ initiative.title }}</option>
														}
													</select>
												}
											</td>
											<td>{{ stateLabel(!!row.linkedInitiativeId, !!row.suggestion) | translate }}</td>
										</tr>
									}
								</tbody>
							</table>
						}
						@if (unpairedGauzyInitiatives().length) {
							<h6>{{ 'EVER_WORKS.REVIEW.UNMATCHED_GAUZY' | translate }}</h6>
							@if (!canCreateMissions) {
								<p data-test="missions-not-created">{{ (mapping?.isEnabled === false ? 'EVER_WORKS.REVIEW.MAPPING_OFF_NO_CREATE' : 'EVER_WORKS.REVIEW.MISSIONS_ONE_WAY') | translate }}</p>
							}
							@for (initiative of unpairedGauzyInitiatives(); track initiative.initiativeId) {
								<div>
									<nb-checkbox
										[name]="'create-mission-' + initiative.initiativeId"
										[attr.data-test]="'create-mission-' + initiative.initiativeId"
										[(ngModel)]="createMissionInEverWorks[initiative.initiativeId]"
										[disabled]="busy.initiatives || initiative.state === draft || !canCreateMissions"
									>
										{{ initiative.title }} — {{ 'EVER_WORKS.REVIEW.CREATE_MISSION_IN_EVER_WORKS' | translate }}
										@if (initiative.state === draft) {
											<small>({{ 'EVER_WORKS.REVIEW.INITIATIVE_DRAFT' | translate }})</small>
										}
									</nb-checkbox>
								</div>
							}
						}
						<div class="actions">
							<button nbButton ghost type="button" data-test="accept-initiatives" [disabled]="busy.initiatives" (click)="acceptInitiatives()">
								{{ 'EVER_WORKS.REVIEW.ACCEPT_ALL' | translate }}
							</button>
							<button nbButton status="primary" type="button" data-test="save-initiatives" [disabled]="busy.initiatives" (click)="saveInitiatives()">
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
	/**
	 * The mapping, for what it lets this review create on the other side (its switch and the missions direction,
	 * as the API checks them). Without it every option is offered and the API decides. A new mapping object (its
	 * switch or directions changed) changes only those options: nothing is read again and no choice is lost.
	 */
	@Input() mapping: EverWorksMapping | null = null;

	readonly create = CREATE;
	readonly draft = DRAFT_INITIATIVE;
	people: EverWorksPeopleView | null = null;
	agents: EverWorksAgentRow[] = [];
	teams: EverWorksTeamsView | null = null;
	projects: EverWorksProjectsView | null = null;
	projectsUnavailable = false;
	initiatives: EverWorksInitiativesView | null = null;
	initiativesUnavailable = false;
	personChoice: Record<string, string> = {};
	teamChoice: Record<string, string> = {};
	workChoice: Record<string, string> = {};
	missionChoice: Record<string, string> = {};
	createInEverWorks: Record<string, boolean> = {};
	createMissionInEverWorks: Record<string, boolean> = {};
	busy: Record<Section, boolean> = { people: false, agents: false, teams: false, projects: false, initiatives: false };
	/** Emits when the inputs change: requests for the previous mapping are cancelled and their answers dropped. */
	private readonly scope$ = new Subject<void>();
	/** Pairings the admin removed here: their suggestion is not preselected again (it would undo the removal). */
	private readonly removed: Record<'people' | 'teams' | 'projects' | 'initiatives', Set<string>> = {
		people: new Set(),
		teams: new Set(),
		projects: new Set(),
		initiatives: new Set()
	};
	errors: Record<Section, string | null> = { people: null, agents: null, teams: null, projects: null, initiatives: null };

	ngOnChanges(changes?: SimpleChanges): void {
		if (changes && !changes['organizationId'] && !changes['integrationTenantId']) return;
		this.scope$.next();
		// Another mapping: nothing of the previous one's initiatives may be shown or sent with the new id.
		this.initiatives = null;
		this.initiativesUnavailable = false;
		this.missionChoice = {};
		this.createMissionInEverWorks = {};
		this.removed.initiatives.clear();
		if (!this.integrationTenantId) return;
		const id = this.integrationTenantId;
		this.run('people', this.api.people(this.organizationId, id), (view) => this.setPeople(view));
		this.run('agents', this.api.agents(this.organizationId, id), (rows) => (this.agents = rows ?? []));
		this.run('teams', this.api.teams(this.organizationId, id), (view) => this.setTeams(view));
		this.run('projects', this.api.projects(this.organizationId, id), (view) => this.setProjects(view));
		this.run('initiatives', this.api.initiatives(this.organizationId, id), (view) => this.setInitiatives(view));
	}

	stateLabel(linked: boolean, suggested: boolean): string {
		return linked ? 'EVER_WORKS.REVIEW.LINKED' : suggested ? 'EVER_WORKS.REVIEW.SUGGESTED' : 'EVER_WORKS.REVIEW.UNMATCHED';
	}

	/** An Ever Works member's name on the People tab (their id when they are no longer a member). */
	memberName(ewUserId: string): string {
		const member = this.people?.members.find((row) => row.ewUserId === ewUserId);
		return member ? member.displayName || member.username : ewUserId;
	}

	/** Gauzy teams paired with nothing and not chosen for an Ever Works team in this form. */
	unpairedGauzyTeams(): Array<{ teamId: string; name: string }> {
		const chosen = new Set(Object.values(this.teamChoice));
		return (this.teams?.unmatchedTeams ?? []).filter((team) => !chosen.has(team.teamId));
	}

	/** Missions can be created as Gauzy initiatives: the mapping is on and missions sync from Ever Works. */
	get canCreateInitiatives(): boolean {
		if (!this.mapping) return true;
		const direction = this.mapping.directions?.['missions'] ?? 'ew_to_gauzy';
		return this.mapping.isEnabled && (direction === 'both' || direction === 'ew_to_gauzy');
	}

	/** Initiatives can be created as Ever Works missions: the mapping is on and missions sync both ways. */
	get canCreateMissions(): boolean {
		if (!this.mapping) return true;
		const direction = this.mapping.directions?.['missions'];
		return this.mapping.isEnabled && (direction === 'both' || direction === 'gauzy_to_ew');
	}

	/** Gauzy initiatives paired with nothing and not chosen for an Ever Works mission in this form. */
	unpairedGauzyInitiatives(): Array<{ initiativeId: string; title: string; state: string }> {
		const chosen = new Set(Object.values(this.missionChoice));
		return (this.initiatives?.unmatchedInitiatives ?? []).filter((initiative) => !chosen.has(initiative.initiativeId));
	}

	// ── People ─────────────────────────────────────────────────────────────────────────────────────

	savePeople(): void {
		const links = (this.people?.members ?? [])
			.filter((row) => !row.linkedEmployeeId && this.personChoice[row.ewUserId])
			.map((row) => ({ ewUserId: row.ewUserId, employeeId: this.personChoice[row.ewUserId] }));
		if (!links.length || this.refuseDuplicates('people', links.map((link) => link.employeeId))) return;
		this.run('people', this.api.decidePeople(this.organizationId, this.id, { links }), (view) => this.setPeople(view));
	}

	acceptPeople(): void {
		this.run('people', this.api.decidePeople(this.organizationId, this.id, { acceptSuggestions: true }), (view) => this.setPeople(view));
	}

	unlinkPerson(ewUserId: string): void {
		this.removed.people.add(ewUserId);
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
		if (this.refuseDuplicates('teams', links.map((link) => link.teamId))) return;
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
		this.removed.teams.add(ewTeamId);
		this.run('teams', this.api.decideTeams(this.organizationId, this.id, { unlinks: [ewTeamId] }), (view) => this.setTeams(view));
	}

	// ── Projects ───────────────────────────────────────────────────────────────────────────────────

	saveProjects(): void {
		const rows = (this.projects?.works ?? []).filter((row) => !row.linkedProjectId && this.workChoice[row.ewWorkId]);
		const links = rows.filter((row) => this.workChoice[row.ewWorkId] !== CREATE).map((row) => ({ ewWorkId: row.ewWorkId, projectId: this.workChoice[row.ewWorkId] }));
		const createInGauzy = rows.filter((row) => this.workChoice[row.ewWorkId] === CREATE).map((row) => row.ewWorkId);
		if (!links.length && !createInGauzy.length) return;
		if (this.refuseDuplicates('projects', links.map((link) => link.projectId))) return;
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
		this.removed.projects.add(ewWorkId);
		this.run('projects', this.api.decideProjects(this.organizationId, this.id, { unlinks: [ewWorkId] }), (view) => this.setProjects(view));
	}

	// ── Initiatives ↔ Missions ─────────────────────────────────────────────────────────────────────

	saveInitiatives(): void {
		const rows = (this.initiatives?.missions ?? []).filter((row) => !row.linkedInitiativeId && this.missionChoice[row.ewMissionId]);
		const links = rows
			.filter((row) => this.missionChoice[row.ewMissionId] !== CREATE)
			.map((row) => ({ ewMissionId: row.ewMissionId, initiativeId: this.missionChoice[row.ewMissionId] }));
		// What the mapping does not allow is never sent: the API would refuse the whole save, pairs included.
		const createInGauzy = this.canCreateInitiatives
			? rows.filter((row) => this.missionChoice[row.ewMissionId] === CREATE).map((row) => row.ewMissionId)
			: [];
		// A draft stays in Gauzy until it is active (the API refuses it); its box is disabled, and never sent.
		const createInEverWorks = this.canCreateMissions
			? this.unpairedGauzyInitiatives()
					.filter((initiative) => this.createMissionInEverWorks[initiative.initiativeId] && initiative.state !== DRAFT_INITIATIVE)
					.map((initiative) => initiative.initiativeId)
			: [];
		if (!links.length && !createInGauzy.length && !createInEverWorks.length) return;
		if (this.refuseDuplicates('initiatives', links.map((link) => link.initiativeId))) return;
		this.run(
			'initiatives',
			this.api.decideInitiatives(this.organizationId, this.id, {
				...(links.length ? { links } : {}),
				...(createInGauzy.length ? { createInGauzy } : {}),
				...(createInEverWorks.length ? { createInEverWorks } : {})
			}),
			(view) => this.setInitiatives(view)
		);
	}

	acceptInitiatives(): void {
		this.run('initiatives', this.api.decideInitiatives(this.organizationId, this.id, { acceptSuggestions: true }), (view) => this.setInitiatives(view));
	}

	unlinkMission(ewMissionId: string): void {
		this.removed.initiatives.add(ewMissionId);
		// A choice kept for it from before (it cannot have one while paired) must not come back either.
		delete this.missionChoice[ewMissionId];
		this.run('initiatives', this.api.decideInitiatives(this.organizationId, this.id, { unlinks: [ewMissionId] }), (view) => this.setInitiatives(view));
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private get id(): string {
		return this.integrationTenantId as string;
	}

	private setPeople(view: EverWorksPeopleView): void {
		this.people = view;
		// A suggestion is preselected; nothing is paired until the admin saves.
		this.personChoice = preselect(
			view.members.filter((row) => !row.linkedEmployeeId).map((row) => ({ id: row.ewUserId, suggested: row.suggestion?.employeeId ?? null })),
			this.removed.people
		);
	}

	private setTeams(view: EverWorksTeamsView): void {
		this.teams = view;
		this.teamChoice = preselect(
			view.teams.filter((row) => !row.linkedTeamId).map((row) => ({ id: row.ewTeamId, suggested: row.suggestion?.teamId ?? null })),
			this.removed.teams
		);
		this.createInEverWorks = {};
	}

	private setProjects(view: EverWorksProjectsView): void {
		this.projects = view;
		this.projectsUnavailable = false;
		this.workChoice = preselect(
			view.works.filter((row) => !row.linkedProjectId).map((row) => ({ id: row.ewWorkId, suggested: row.suggestion?.projectId ?? null })),
			this.removed.projects
		);
	}

	/**
	 * A new view of the tab. Choices the admin made for missions that are still unpaired are kept (removing one
	 * pairing must not reset the others, nor bring back a suggestion the admin turned down); only a mission seen
	 * for the first time gets its suggestion preselected. Ticks stay for initiatives still paired with nothing.
	 */
	private setInitiatives(view: EverWorksInitiativesView): void {
		const previous = this.missionChoice;
		const valid = new Set(['', CREATE, ...view.unmatchedInitiatives.map((initiative) => initiative.initiativeId)]);
		// A same-title suggestion is preselected only when no other free initiative has that title too (an older
		// API may still suggest the first of several): which one is meant is the admin's call.
		const titleKey = (title: string | null | undefined) => (title ?? '').trim().toLowerCase();
		const titles = new Map<string, number>();
		for (const initiative of view.unmatchedInitiatives) titles.set(titleKey(initiative.title), (titles.get(titleKey(initiative.title)) ?? 0) + 1);
		const unambiguous = (initiativeId: string | undefined) => {
			const initiative = view.unmatchedInitiatives.find((row) => row.initiativeId === initiativeId);
			return initiative && (titles.get(titleKey(initiative.title)) ?? 0) === 1 ? initiative.initiativeId : null;
		};
		const fresh = preselect(
			view.missions
				.filter((row) => !row.linkedInitiativeId)
				.map((row) => ({ id: row.ewMissionId, suggested: unambiguous(row.suggestion?.initiativeId) })),
			this.removed.initiatives
		);
		this.missionChoice = Object.fromEntries(
			Object.entries(fresh).map(([id, suggested]) => [id, id in previous && valid.has(previous[id]) ? previous[id] : suggested])
		);
		const unmatched = new Set(view.unmatchedInitiatives.map((initiative) => initiative.initiativeId));
		this.createMissionInEverWorks = Object.fromEntries(
			Object.entries(this.createMissionInEverWorks).filter(([id, ticked]) => ticked && unmatched.has(id))
		);
		this.initiatives = view;
		this.initiativesUnavailable = false;
	}

	/** A Gauzy record chosen for two Ever Works records is refused here, before the API refuses the whole save. */
	private refuseDuplicates(section: 'people' | 'teams' | 'projects' | 'initiatives', gauzyIds: string[]): boolean {
		if (new Set(gauzyIds).size === gauzyIds.length) return false;
		this.errors[section] = 'EVER_WORKS.REVIEW.DUPLICATE_CHOICE';
		this.cdr.markForCheck();
		return true;
	}

	private run<T>(section: Section, request: Observable<T>, apply: (value: T) => void): void {
		this.busy[section] = true;
		this.errors[section] = null;
		this.cdr.markForCheck();
		request.pipe(takeUntil(this.scope$)).subscribe({
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
				} else if (section === 'initiatives' && isNotFound(error) && !this.initiatives) {
					// The initiatives tab (G-P2-2) is not part of this installation's API yet.
					this.initiativesUnavailable = true;
				} else {
					this.errors[section] = errorText(error);
				}
				this.cdr.markForCheck();
			}
		});
	}
}
