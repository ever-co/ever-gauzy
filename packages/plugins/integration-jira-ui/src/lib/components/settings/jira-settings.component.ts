import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, combineLatest, distinctUntilChanged, forkJoin, interval, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';
import { JIRA_LINK } from '../../integration-jira-ui.plugin';
import {
	JiraConnectionSummary,
	JiraDirection,
	JiraMapping,
	JiraMappingInput,
	JiraProject,
	JiraProjectDetail,
	JiraRun,
	JiraRunFailure,
	JiraSite,
	JiraUiService
} from '../../services/jira-ui.service';
import { DEFAULT_JIRA_STATUS_MAP, errorText, JIRA_STATUS_CATEGORIES, JiraStatusCategory, statusMapOf } from '../shared/jira-ui.utils';
import { JiraConflictsComponent } from '../conflicts/jira-conflicts.component';

const DIRECTIONS: JiraDirection[] = ['inbound', 'outbound', 'both'];
/** How often the runs are read again while one is running. */
const RUNS_POLL_MS = 10_000;
/** How many failed issues a run's report line names (the report itself names up to fifty). */
const REPORT_FAILURES_SHOWN = 5;

/**
 * Whether the newer runs read holds a run that finished since the older one: one that was running and is not any
 * more (done, failed, or gone from the list), or one first seen already finished (it started and ended between two
 * reads; its mapping's position moved, and it may have found conflicts).
 */
export function finishedRuns(before: readonly JiraRun[], after: readonly JiraRun[]): boolean {
	const earlier = new Set(before.map((run) => run.id));
	const now = new Map(after.map((run) => [run.id, run.status]));
	if (before.some((run) => run.status === 'running' && now.get(run.id) !== 'running')) return true;
	return after.some((run) => !earlier.has(run.id) && run.status !== 'running');
}

/** The add-mapping form. */
interface MappingDraft {
	jiraProjectId: string;
	projectId: string;
	direction: JiraDirection;
	syncEnabled: boolean;
	/** The task status of each status category. */
	categories: Record<JiraStatusCategory, string>;
	/** The task status of a named Jira status, by its id (blank: it follows its category). */
	named: Record<string, string>;
	/** The issue types brought in, by id (none checked: every type). */
	issueTypeIds: string[];
}

/**
 * The settings of a Jira connection: its site (chosen here when the token reaches several, and kept while mappings
 * exist), its webhook, the Jira project ↔ project mappings (add with a status map and an issue-type filter, change
 * the direction or the switch, import now, remove), the sync conflicts to resolve, and the latest runs with their
 * report and how many conflicts each found (a count opens the conflicts of its run).
 */
@Component({
	selector: 'ngx-jira-settings',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbInputModule,
		NbSelectModule,
		TranslatePipe,
		JiraConflictsComponent
	],
	template: `
		<nb-card>
			<nb-card-header class="header">
				<span>{{ 'JIRA.SETTINGS.TITLE' | translate }}</span>
				<button nbButton ghost size="small" type="button" data-test="back" (click)="back()">{{ 'JIRA.COMMON.BACK' | translate }}</button>
			</nb-card-header>
			<nb-card-body>
				@if (error) {
					<nb-alert status="danger" role="alert" data-test="error">{{ error }}</nb-alert>
				}
				@if (notice) {
					<nb-alert status="success" data-test="notice">{{ notice }}</nb-alert>
				}
				@if (loading) {
					<p data-test="loading">{{ 'JIRA.LOADING' | translate }}</p>
				} @else if (connection) {
					<section>
						<h5>{{ 'JIRA.SETTINGS.OVERVIEW' | translate }}</h5>
						@if (connection.attentionReason) {
							<nb-alert status="warning" role="alert" data-test="attention">
								{{ 'JIRA.CONNECTED.ATTENTION' | translate: { reason: ('JIRA.CONNECTED.REASONS.' + connection.attentionReason | translate) } }}
							</nb-alert>
						}
						<dl class="facts">
							<dt>{{ 'JIRA.CONNECTED.SITE' | translate }}</dt>
							<dd data-test="site">{{ connection.siteName || connection.siteUrl || ('JIRA.SITES.NONE' | translate) }}</dd>
							<dt>{{ 'JIRA.CONNECTED.ACCOUNT' | translate }}</dt>
							<dd data-test="account">{{ connection.accountName || '—' }}</dd>
							<dt>{{ 'JIRA.CONNECTED.CONNECTED_ON' | translate }}</dt>
							<dd>{{ connection.createdAt ? (connection.createdAt | date: 'medium') : '—' }}</dd>
						</dl>
						<button nbButton status="danger" ghost size="small" type="button" data-test="disconnect" [disabled]="busy" (click)="disconnect()">
							{{ 'JIRA.SETTINGS.DISCONNECT' | translate }}
						</button>
					</section>

					<section class="site" data-test="site-section">
						<h5>{{ 'JIRA.SITES.TITLE' | translate }}</h5>
						@if (connection.siteRequired) {
							<nb-alert status="warning" role="alert" data-test="site-required">{{ 'JIRA.SITES.REQUIRED' | translate }}</nb-alert>
						}
						@if (!sites.length) {
							<p data-test="no-sites">{{ 'JIRA.SITES.EMPTY' | translate }}</p>
						} @else {
							<div class="row">
								<label>
									<span>{{ 'JIRA.SITES.SITE' | translate }}</span>
									<nb-select fullWidth [(selected)]="siteDraft" [disabled]="busy || siteLocked()" data-test="site-select">
										@for (site of sites; track site.id) {
											<nb-option [value]="site.id">{{ site.name }} · {{ site.url }}</nb-option>
										}
									</nb-select>
								</label>
							</div>
							@if (siteLocked()) {
								<small class="note" data-test="site-locked">{{ 'JIRA.SITES.LOCKED' | translate }}</small>
							} @else {
								<button
									nbButton
									status="primary"
									size="small"
									type="button"
									data-test="choose-site"
									[disabled]="busy || !siteDraft || siteDraft === connection.cloudId"
									(click)="chooseSite()"
								>
									{{ 'JIRA.SITES.CHOOSE' | translate }}
								</button>
							}
						}
					</section>

					@if (!connection.siteRequired) {
						<section class="webhook" data-test="webhook-section">
							<h5>{{ 'JIRA.WEBHOOK.TITLE' | translate }}</h5>
							<p class="intro">{{ 'JIRA.WEBHOOK.INTRO' | translate }}</p>
							@if (connection.webhookError) {
								<nb-alert status="warning" data-test="webhook-error">{{ 'JIRA.WEBHOOK.FAILED' | translate: { error: connection.webhookError } }}</nb-alert>
							}
							<p data-test="webhook-state">
								@if (connection.webhookExpiresAt) {
									{{ 'JIRA.WEBHOOK.ACTIVE' | translate: { date: (connection.webhookExpiresAt | date: 'medium') } }}
								} @else {
									{{ 'JIRA.WEBHOOK.NONE' | translate }}
								}
							</p>
							<button nbButton ghost size="small" type="button" data-test="register-webhook" [disabled]="busy" (click)="registerWebhook()">
								{{ 'JIRA.WEBHOOK.REGISTER' | translate }}
							</button>
						</section>

						<section class="mappings">
							<h5>{{ 'JIRA.MAPPINGS.TITLE' | translate }}</h5>
							<p class="intro">{{ 'JIRA.MAPPINGS.INTRO' | translate }}</p>
							@if (!mappings.length) {
								<p data-test="no-mappings">{{ 'JIRA.MAPPINGS.EMPTY' | translate }}</p>
							} @else {
								<table class="table" data-test="mappings">
									<thead>
										<tr>
											<th>{{ 'JIRA.MAPPINGS.JIRA_PROJECT' | translate }}</th>
											<th>{{ 'JIRA.MAPPINGS.PROJECT' | translate }}</th>
											<th>{{ 'JIRA.MAPPINGS.DIRECTION' | translate }}</th>
											<th>{{ 'JIRA.MAPPINGS.ISSUE_TYPES' | translate }}</th>
											<th>{{ 'JIRA.MAPPINGS.SYNC' | translate }}</th>
											<th>{{ 'JIRA.MAPPINGS.LAST_IMPORT' | translate }}</th>
											<th></th>
										</tr>
									</thead>
									<tbody>
										@for (mapping of mappings; track mapping.id) {
											<tr [attr.data-test]="'mapping-' + mapping.id">
												<td>
													<strong>{{ mapping.jiraProjectKey || '' }}</strong> {{ mapping.jiraProjectName || mapping.jiraProjectId }}
												</td>
												<td>{{ projectName(mapping.projectId) }}</td>
												<td>
													<nb-select size="small" [selected]="mapping.direction" [disabled]="busy" (selectedChange)="changeDirection(mapping, $event)">
														@for (direction of directions; track direction) {
															<nb-option [value]="direction">{{ 'JIRA.MAPPINGS.DIRECTIONS.' + direction | translate }}</nb-option>
														}
													</nb-select>
												</td>
												<td [attr.data-test]="'issue-types-' + mapping.id">
													@if (mapping.issueTypeIds.length) {
														{{ 'JIRA.MAPPINGS.ISSUE_TYPES_SOME' | translate: { count: mapping.issueTypeIds.length } }}
													} @else {
														{{ 'JIRA.MAPPINGS.ISSUE_TYPES_ALL' | translate }}
													}
												</td>
												<td>
													<nb-checkbox [checked]="mapping.syncEnabled" [disabled]="busy" (checkedChange)="changeSync(mapping, $event)">
														{{ (mapping.syncEnabled ? 'JIRA.MAPPINGS.ENABLED' : 'JIRA.MAPPINGS.DISABLED') | translate }}
													</nb-checkbox>
												</td>
												<td>
													{{ mapping.lastImportedAt ? (mapping.lastImportedAt | date: 'medium') : ('JIRA.COMMON.NEVER' | translate) }}
													@if (mapping.lastError) {
														<small class="note" [attr.title]="mapping.lastError">{{ 'JIRA.MAPPINGS.LAST_ERROR' | translate }}: {{ mapping.lastError }}</small>
													}
												</td>
												<td class="actions">
													<button
														nbButton
														size="tiny"
														status="primary"
														type="button"
														[attr.data-test]="'import-' + mapping.id"
														[disabled]="busy || !bringsIssuesIn(mapping)"
														(click)="importNow(mapping, false)"
													>
														{{ 'JIRA.MAPPINGS.IMPORT' | translate }}
													</button>
													<button nbButton size="tiny" ghost type="button" [disabled]="busy || !bringsIssuesIn(mapping)" (click)="importNow(mapping, true)">
														{{ 'JIRA.MAPPINGS.IMPORT_FULL' | translate }}
													</button>
													<button nbButton size="tiny" ghost status="danger" type="button" [disabled]="busy" (click)="remove(mapping)">
														{{ 'JIRA.COMMON.REMOVE' | translate }}
													</button>
												</td>
											</tr>
										}
									</tbody>
								</table>
							}

							<form class="add" (ngSubmit)="add()" data-test="add-form">
								<h6>{{ 'JIRA.MAPPINGS.ADD' | translate }}</h6>
								@if (!jiraProjects.length) {
									<p data-test="no-jira-projects">{{ 'JIRA.MAPPINGS.NO_JIRA_PROJECTS' | translate }}</p>
								}
								<div class="row">
									<label>
										<span>{{ 'JIRA.MAPPINGS.JIRA_PROJECT' | translate }}</span>
										<nb-select
											fullWidth
											[selected]="draft.jiraProjectId"
											(selectedChange)="chooseJiraProject($event)"
											[disabled]="busy || !jiraProjects.length"
											data-test="jira-project"
										>
											@for (project of unmappedJiraProjects(); track project.id) {
												<nb-option [value]="project.id">{{ project.key }} · {{ project.name }}</nb-option>
											}
										</nb-select>
									</label>
									<label>
										<span>{{ 'JIRA.MAPPINGS.PROJECT' | translate }}</span>
										<nb-select fullWidth [(selected)]="draft.projectId" [disabled]="busy" data-test="project">
											@for (project of projects; track project.id) {
												<nb-option [value]="project.id">{{ project.name }}</nb-option>
											}
										</nb-select>
									</label>
									<label>
										<span>{{ 'JIRA.MAPPINGS.DIRECTION' | translate }}</span>
										<nb-select fullWidth [(selected)]="draft.direction" [disabled]="busy" data-test="direction">
											@for (direction of directions; track direction) {
												<nb-option [value]="direction">{{ 'JIRA.MAPPINGS.DIRECTIONS.' + direction | translate }}</nb-option>
											}
										</nb-select>
									</label>
								</div>
								<fieldset class="status-map">
									<legend>{{ 'JIRA.MAPPINGS.STATUS_MAP' | translate }}</legend>
									<small class="note">{{ 'JIRA.MAPPINGS.STATUS_MAP_HINT' | translate }}</small>
									<div class="row">
										@for (category of categories; track category) {
											<label>
												<span>{{ 'JIRA.MAPPINGS.CATEGORIES.' + category | translate }}</span>
												<input
													nbInput
													fullWidth
													fieldSize="small"
													[name]="'category-' + category"
													[(ngModel)]="draft.categories[category]"
													[disabled]="busy"
													[attr.data-test]="'category-' + category"
												/>
											</label>
										}
									</div>
									@if (detailLoading) {
										<p data-test="detail-loading">{{ 'JIRA.LOADING' | translate }}</p>
									} @else if (detail) {
										@if (detail.statuses.length) {
											<small class="note">{{ 'JIRA.MAPPINGS.NAMED_STATUSES_HINT' | translate }}</small>
											<div class="row" data-test="named-statuses">
												@for (status of detail.statuses; track status.id) {
													<label>
														<span>{{ status.name }}</span>
														<input
															nbInput
															fullWidth
															fieldSize="small"
															[name]="'status-' + status.id"
															[(ngModel)]="draft.named[status.id]"
															[placeholder]="draft.categories[categoryOf(status.statusCategory.key)]"
															[disabled]="busy"
															[attr.data-test]="'status-' + status.id"
														/>
													</label>
												}
											</div>
										}
									}
								</fieldset>
								@if (detail && !detailLoading && detail.issueTypes.length) {
									<fieldset class="issue-types" data-test="issue-types">
										<legend>{{ 'JIRA.MAPPINGS.ISSUE_TYPES' | translate }}</legend>
										<small class="note">{{ 'JIRA.MAPPINGS.ISSUE_TYPES_HINT' | translate }}</small>
										<div class="checks">
											@for (type of detail.issueTypes; track type.id) {
												<nb-checkbox
													[checked]="draft.issueTypeIds.includes(type.id)"
													[disabled]="busy"
													(checkedChange)="toggleIssueType(type.id, $event)"
													[attr.data-test]="'issue-type-' + type.id"
												>
													{{ type.name }}
												</nb-checkbox>
											}
										</div>
									</fieldset>
								}
								<nb-checkbox [(checked)]="draft.syncEnabled" [disabled]="busy">{{ 'JIRA.MAPPINGS.SYNC' | translate }}</nb-checkbox>
								<div class="submit">
									<button nbButton status="primary" type="submit" data-test="add" [disabled]="busy || detailLoading || !draft.jiraProjectId || !draft.projectId">
										{{ (busy ? 'JIRA.MAPPINGS.ADDING' : 'JIRA.COMMON.SAVE') | translate }}
									</button>
								</div>
							</form>
						</section>

						<section class="conflicts">
							<ngx-jira-conflicts [integrationId]="connection.id" [(runId)]="conflictRunId" />
						</section>

						<section class="runs">
							<h5>
								{{ 'JIRA.RUNS.TITLE' | translate }}
								<button nbButton ghost size="tiny" type="button" data-test="refresh-runs" (click)="loadRuns()">{{ 'JIRA.COMMON.REFRESH' | translate }}</button>
							</h5>
							@if (!runs.length) {
								<p data-test="no-runs">{{ 'JIRA.RUNS.EMPTY' | translate }}</p>
							} @else {
								<table class="table" data-test="runs">
									<thead>
										<tr>
											<th>{{ 'JIRA.RUNS.KIND' | translate }}</th>
											<th>{{ 'JIRA.RUNS.STATUS' | translate }}</th>
											<th>{{ 'JIRA.RUNS.STARTED' | translate }}</th>
											<th>{{ 'JIRA.RUNS.FINISHED' | translate }}</th>
											<th>{{ 'JIRA.RUNS.COUNTS' | translate }}</th>
											<th>{{ 'JIRA.RUNS.CONFLICTS' | translate }}</th>
											<th>{{ 'JIRA.RUNS.REPORT' | translate }}</th>
											<th>{{ 'JIRA.RUNS.ERROR' | translate }}</th>
										</tr>
									</thead>
									<tbody>
										@for (run of runs; track run.id) {
											<tr>
												<td>{{ 'JIRA.RUNS.KINDS.' + run.kind | translate }}{{ run.full ? ' ' + ('JIRA.RUNS.FULL' | translate) : '' }}</td>
												<td>{{ 'JIRA.RUNS.STATUSES.' + run.status | translate }}</td>
												<td>{{ run.startedAt ? (run.startedAt | date: 'short') : '—' }}</td>
												<td>{{ run.finishedAt ? (run.finishedAt | date: 'short') : '—' }}</td>
												<td>{{ run.createdCount }} / {{ run.updatedCount }} / {{ run.skippedCount }} / {{ run.failedCount }}</td>
												<td [attr.data-test]="'run-conflicts-' + run.id">
													@if (run.conflictCount) {
														<button
															nbButton
															ghost
															size="tiny"
															status="warning"
															type="button"
															[attr.title]="'JIRA.RUNS.SHOW_CONFLICTS' | translate"
															(click)="showRunConflicts(run)"
														>
															{{ run.conflictCount }}
														</button>
													} @else {
														0
													}
												</td>
												<td class="report" [attr.data-test]="'run-report-' + run.id">
													@if (run.report; as report) {
														{{
															'JIRA.RUNS.REPORT_LINE'
																| translate: { pages: report.pages, issues: report.issuesRead, comments: report.comments, links: report.links }
														}}
														@if (!report.complete && run.status !== 'running') {
															<small class="note" data-test="report-partial">{{ 'JIRA.RUNS.REPORT_PARTIAL' | translate }}</small>
														}
														@if (report.failures.length) {
															<details class="note failures" [attr.data-test]="'report-failures-' + run.id">
																<summary>{{ 'JIRA.RUNS.REPORT_FAILURES' | translate }} {{ failureKeys(run) }}</summary>
																<ul>
																	@for (failure of shownFailures(run); track failure.key) {
																		<li class="failure"><strong>{{ failure.key }}</strong>: {{ failure.error }}</li>
																	}
																</ul>
																@if (hiddenFailures(run); as more) {
																	{{ 'JIRA.RUNS.REPORT_MORE' | translate: { count: more } }}
																}
															</details>
														}
													} @else {
														—
													}
												</td>
												<td class="error-cell" [attr.title]="run.lastError">{{ run.lastError || '' }}</td>
											</tr>
										}
									</tbody>
								</table>
							}
						</section>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.header {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			section {
				margin-bottom: 2rem;
			}
			.facts {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: 0.25rem 1rem;
				margin: 1rem 0;
			}
			.facts dt {
				opacity: 0.7;
			}
			.intro,
			.note {
				opacity: 0.8;
				display: block;
			}
			.row {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
				gap: 1rem;
				margin: 0.75rem 0;
			}
			label > span {
				display: block;
				margin-bottom: 0.25rem;
				font-size: 0.85rem;
			}
			.status-map,
			.issue-types {
				border: 1px solid var(--border-basic-color-3);
				border-radius: var(--border-radius);
				padding: 0.5rem 1rem 1rem;
				margin: 1rem 0;
			}
			.checks {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem 1.5rem;
				margin-top: 0.5rem;
			}
			.actions button {
				margin-right: 0.25rem;
			}
			.submit {
				margin-top: 1rem;
			}
			.failures ul {
				margin: 0.25rem 0 0;
				padding-left: 1rem;
			}
			.failure strong {
				font-family: monospace;
			}
			.error-cell {
				max-width: 24rem;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		`
	]
})
export class JiraSettingsComponent implements OnInit {
	private readonly api = inject(JiraUiService);
	private readonly projectsService = inject(OrganizationProjectsService);
	private readonly translate = inject(TranslateService);
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	/** The conflict list (read again when a run finishes) and its host (scrolled to when a run's count opens it). */
	@ViewChild(JiraConflictsComponent) private readonly conflictList?: JiraConflictsComponent;
	@ViewChild(JiraConflictsComponent, { read: ElementRef }) private readonly conflictHost?: ElementRef<HTMLElement>;

	readonly directions = DIRECTIONS;
	readonly categories = JIRA_STATUS_CATEGORIES;

	integrationId: string | null = null;
	organizationId: string | null = null;
	connection: JiraConnectionSummary | null = null;
	sites: JiraSite[] = [];
	/** The site the site form names (the connection's, until someone picks another). */
	siteDraft = '';
	jiraProjects: JiraProject[] = [];
	projects: IOrganizationProject[] = [];
	mappings: JiraMapping[] = [];
	runs: JiraRun[] = [];
	/** The issue types and statuses of the Jira project the add form names. */
	detail: JiraProjectDetail | null = null;
	detailLoading = false;
	/** The run whose conflicts the list shows (a run's count in the sync log sets it); null: every run. */
	conflictRunId: string | null = null;
	draft: MappingDraft = this.emptyDraft();
	loading = true;
	busy = false;
	error: string | null = null;
	notice: string | null = null;
	private detailRead: Subscription | null = null;

	ngOnInit(): void {
		combineLatest([
			this.route.paramMap.pipe(map((params) => params.get('integrationId'))),
			this.store.selectedOrganization$.pipe(
				map((organization) => organization?.id ?? null),
				distinctUntilChanged()
			)
		])
			.pipe(
				switchMap(([integrationId, organizationId]) => {
					// Another organization selected: this connection is the former one's, so the page goes back to the Jira
					// overview, which reads the new organization's connection.
					if (this.organizationId && organizationId && organizationId !== this.organizationId) {
						this.organizationId = organizationId;
						void this.router.navigate([JIRA_LINK]);
						return of(null);
					}
					// Another connection: the run filter of the last one means nothing here.
					if (integrationId !== this.integrationId) this.conflictRunId = null;
					this.integrationId = integrationId;
					this.organizationId = organizationId;
					this.loading = true;
					this.error = null;
					this.cdr.markForCheck();
					if (!integrationId || !organizationId) {
						// No organization selected (any more): nothing of the former one stays on the page.
						this.clearConnection();
						return of(null);
					}
					return this.load(integrationId, organizationId);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(() => {
				this.loading = false;
				this.cdr.markForCheck();
			});
		// While an import runs, the runs are read again every few seconds.
		interval(RUNS_POLL_MS)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => {
				if (this.integrationId && this.runs.some((run) => run.status === 'running')) this.loadRuns();
			});
		this.destroyRef.onDestroy(() => this.detailRead?.unsubscribe());
	}

	/**
	 * The connection and its sites, then (once a site is chosen) its Jira projects, the organization's projects, the
	 * mappings and the runs. A connection still waiting for its site reads nothing of a site.
	 */
	private load(integrationId: string, organizationId: string): Observable<unknown> {
		const tenantId = this.store.selectedOrganization?.tenantId;
		return forkJoin({
			connection: this.api.summary(integrationId),
			sites: this.api.sites(integrationId).pipe(catchError((error) => this.fail(error, [] as JiraSite[])))
		}).pipe(
			switchMap(({ connection, sites }) => {
				const site$ = connection.siteRequired
					? of({ jiraProjects: [] as JiraProject[], projects: [] as IOrganizationProject[], mappings: [] as JiraMapping[], runs: [] as JiraRun[] })
					: forkJoin({
							jiraProjects: this.api.projects(integrationId).pipe(catchError((error) => this.fail(error, [] as JiraProject[]))),
							projects: this.projectsService
								.getAll([], { organizationId, tenantId } as never)
								.then((page) => page.items)
								.catch((error) => this.failed(error, [] as IOrganizationProject[])),
							mappings: this.api.mappings(integrationId),
							runs: this.api.runs(integrationId).pipe(catchError((error) => this.fail(error, [] as JiraRun[])))
						});
				return site$.pipe(map((rest) => ({ connection, sites, ...rest })));
			}),
			map((result) => {
				// The page moved to another connection or organization meanwhile: this read is not its.
				if (integrationId !== this.integrationId || organizationId !== this.organizationId) return null;
				// A connection of another organization than the selected one: back to the Jira overview, which reads the
				// selected organization's.
				if (result.connection.organizationId && result.connection.organizationId !== organizationId) {
					this.clearConnection();
					void this.router.navigate([JIRA_LINK]);
					return null;
				}
				this.connection = result.connection;
				this.sites = result.sites;
				this.siteDraft = result.connection.cloudId ?? result.sites.find((site) => site.selected)?.id ?? '';
				this.jiraProjects = result.jiraProjects;
				this.projects = result.projects;
				this.mappings = result.mappings;
				this.runs = result.runs;
				this.resetDraft();
				return result;
			}),
			catchError((error) => {
				this.error = errorText(error);
				this.connection = null;
				return of(null);
			})
		);
	}

	loadRuns(): void {
		const integrationId = this.integrationId;
		if (!integrationId) return;
		this.api.runs(integrationId).subscribe({
			next: (runs) => {
				// The page moved to another connection meanwhile: this read is not its sync log.
				if (integrationId !== this.integrationId) return;
				const finished = finishedRuns(this.runs, runs);
				this.runs = runs;
				// A run that just finished (another may still run) may have found conflicts and moved its mapping's position.
				if (finished) {
					this.conflictList?.load(true);
					this.loadMappings();
				}
				this.cdr.markForCheck();
			},
			error: () => undefined
		});
	}

	loadMappings(): void {
		const integrationId = this.integrationId;
		if (!integrationId) return;
		this.api.mappings(integrationId).subscribe({
			next: (mappings) => {
				if (integrationId !== this.integrationId) return;
				this.mappings = mappings;
				this.cdr.markForCheck();
			},
			error: (error) => this.showError(error)
		});
	}

	/** The sync log's count of a run: the conflict list shows the open conflicts that run found. */
	showRunConflicts(run: JiraRun): void {
		this.conflictRunId = run.id;
		this.conflictList?.showOpen();
		this.cdr.markForCheck();
		this.conflictHost?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
	}

	/** Whether the site may not change: a connection with mappings keeps its site (a project id is unique only on its site). */
	siteLocked(): boolean {
		return !!this.connection?.cloudId && this.mappings.length > 0;
	}

	/** Chooses the site the form names; the page is read again for it (its projects, its webhook). */
	chooseSite(): void {
		const integrationId = this.integrationId;
		const organizationId = this.organizationId;
		if (!integrationId || !organizationId || !this.siteDraft || this.siteDraft === this.connection?.cloudId || this.siteLocked()) return;
		this.request(this.api.selectSite(integrationId, this.siteDraft), () => {
			this.notice = this.translateKey('JIRA.SITES.CHOSEN');
			this.loading = true;
			this.load(integrationId, organizationId)
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe(() => {
					this.loading = false;
					this.cdr.markForCheck();
				});
		});
	}

	/** Brings the connection's webhook in line with its mappings now, and says what happened. */
	registerWebhook(): void {
		const integrationId = this.integrationId;
		const organizationId = this.organizationId;
		if (!integrationId) return;
		this.request(this.api.registerWebhook(integrationId), ({ outcome, connection }) => {
			// The page moved to another connection or organization meanwhile: this answer is not its.
			if (integrationId !== this.integrationId || organizationId !== this.organizationId) return;
			this.connection = connection;
			this.notice = this.translateKey(`JIRA.WEBHOOK.OUTCOMES.${outcome}`);
		});
	}

	/** The Jira projects not mapped yet (the add form offers those). */
	unmappedJiraProjects(): JiraProject[] {
		const mapped = new Set(this.mappings.map((mapping) => mapping.jiraProjectId));
		return this.jiraProjects.filter((project) => !mapped.has(project.id));
	}

	projectName(projectId: string): string {
		return this.projects.find((project) => project.id === projectId)?.name ?? projectId;
	}

	/** The add form names a Jira project: its statuses and issue types are read for the status map and the filter. */
	chooseJiraProject(jiraProjectId: string): void {
		if (jiraProjectId === this.draft.jiraProjectId) return;
		this.draft = { ...this.draft, jiraProjectId, named: {}, issueTypeIds: [] };
		this.detail = null;
		this.detailRead?.unsubscribe();
		this.detailRead = null;
		const integrationId = this.integrationId;
		if (!integrationId || !jiraProjectId) {
			this.detailLoading = false;
			this.cdr.markForCheck();
			return;
		}
		this.detailLoading = true;
		this.cdr.markForCheck();
		this.detailRead = this.api.project(integrationId, jiraProjectId).subscribe({
			next: (detail) => {
				// The form moved to another Jira project meanwhile: this read is not its.
				if (jiraProjectId !== this.draft.jiraProjectId) return;
				this.detail = detail;
				this.detailLoading = false;
				this.cdr.markForCheck();
			},
			error: (error) => {
				if (jiraProjectId !== this.draft.jiraProjectId) return;
				// The mapping can still be made with the categories alone (every issue type).
				this.detailLoading = false;
				this.showError(error);
			}
		});
	}

	/** The category a Jira status belongs to, as the status map names it (an unknown one reads as `new`, as the API does). */
	categoryOf(key: string): JiraStatusCategory {
		return (JIRA_STATUS_CATEGORIES as readonly string[]).includes(key) ? (key as JiraStatusCategory) : 'new';
	}

	toggleIssueType(issueTypeId: string, checked: boolean): void {
		const others = this.draft.issueTypeIds.filter((id) => id !== issueTypeId);
		this.draft = { ...this.draft, issueTypeIds: checked ? [...others, issueTypeId] : others };
		this.cdr.markForCheck();
	}

	/** The keys of the failed issues a run's report line names. */
	failureKeys(run: JiraRun): string {
		return this.shownFailures(run)
			.map((failure) => failure.key)
			.join(', ');
	}

	/** The failed issues a run's report line names, by key, each with its error. */
	shownFailures(run: JiraRun): JiraRunFailure[] {
		return (run.report?.failures ?? []).slice(0, REPORT_FAILURES_SHOWN);
	}

	/** The failed issues the report line does not name: the rest of the report's list, and those the report itself left out. */
	hiddenFailures(run: JiraRun): number {
		const failures = run.report?.failures ?? [];
		return Math.max(0, failures.length - REPORT_FAILURES_SHOWN) + (run.report?.moreFailures ?? 0);
	}

	add(): void {
		if (!this.integrationId || !this.draft.jiraProjectId || !this.draft.projectId || this.busy || this.detailLoading) return;
		const project = this.jiraProjects.find((item) => item.id === this.draft.jiraProjectId);
		// Only the statuses and types of the project the form names (a detail of another project never reaches the input).
		const detail = this.detail?.project.id === this.draft.jiraProjectId ? this.detail : null;
		const statusIds = new Set((detail?.statuses ?? []).map((status) => status.id));
		const typeIds = new Set((detail?.issueTypes ?? []).map((type) => type.id));
		const named = Object.fromEntries(Object.entries(this.draft.named).filter(([id]) => statusIds.has(id)));
		const input: JiraMappingInput = {
			jiraProjectId: this.draft.jiraProjectId,
			jiraProjectKey: project?.key ?? null,
			jiraProjectName: project?.name ?? null,
			projectId: this.draft.projectId,
			direction: this.draft.direction,
			syncEnabled: this.draft.syncEnabled,
			statusMap: statusMapOf(this.draft.categories, named),
			issueTypeIds: this.draft.issueTypeIds.filter((id) => typeIds.has(id))
		};
		this.request(this.api.createMapping(this.integrationId, input), () => {
			this.resetDraft();
			this.loadMappings();
		});
	}

	changeDirection(mapping: JiraMapping, direction: JiraDirection): void {
		if (!this.integrationId || direction === mapping.direction) return;
		this.request(this.api.updateMapping(this.integrationId, mapping.id, { direction }), (updated) => this.replace(updated));
	}

	changeSync(mapping: JiraMapping, syncEnabled: boolean): void {
		if (!this.integrationId || syncEnabled === mapping.syncEnabled) return;
		this.request(this.api.updateMapping(this.integrationId, mapping.id, { syncEnabled }), (updated) => this.replace(updated));
	}

	/** Whether the API imports a mapping: one that brings issues in (switched on, not outbound only). */
	bringsIssuesIn(mapping: JiraMapping): boolean {
		return mapping.syncEnabled && mapping.direction !== 'outbound';
	}

	importNow(mapping: JiraMapping, full: boolean): void {
		if (!this.integrationId || !this.bringsIssuesIn(mapping)) return;
		this.request(this.api.importNow(this.integrationId, mapping.id, full), () => {
			this.notice = this.translateKey('JIRA.MAPPINGS.IMPORT_STARTED');
			this.loadRuns();
		});
	}

	remove(mapping: JiraMapping): void {
		if (!this.integrationId || !window.confirm(this.translateKey('JIRA.MAPPINGS.REMOVE_CONFIRM'))) return;
		this.request(this.api.removeMapping(this.integrationId, mapping.id), () => this.loadMappings());
	}

	disconnect(): void {
		if (!this.integrationId || !window.confirm(this.translateKey('JIRA.SETTINGS.DISCONNECT_CONFIRM'))) return;
		this.request(this.api.disconnect(this.integrationId), () => void this.router.navigate([JIRA_LINK]));
	}

	back(): void {
		void this.router.navigate([JIRA_LINK]);
	}

	/** One request with the busy flag and the error line. */
	private request<T>(request: Observable<T>, apply: (value: T) => void): void {
		this.busy = true;
		this.error = null;
		this.notice = null;
		this.cdr.markForCheck();
		// Bound to the page's life: a disconnect answered after the person left never navigates their new page.
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (value) => {
				this.busy = false;
				apply(value);
				this.cdr.markForCheck();
			},
			error: (error) => {
				this.busy = false;
				this.showError(error);
			}
		});
	}

	private replace(updated: JiraMapping): void {
		this.mappings = this.mappings.map((mapping) => (mapping.id === updated.id ? updated : mapping));
	}

	private showError(error: unknown): void {
		this.error = errorText(error);
		this.cdr.markForCheck();
	}

	private fail<T>(error: unknown, fallback: T): Observable<T> {
		this.error = this.error ?? errorText(error);
		return of(fallback);
	}

	private failed<T>(error: unknown, fallback: T): T {
		this.error = this.error ?? errorText(error);
		return fallback;
	}

	/** Nothing of a connection on the page: no organization is selected, or the connection is another organization's. */
	private clearConnection(): void {
		this.connection = null;
		this.sites = [];
		this.jiraProjects = [];
		this.projects = [];
		this.mappings = [];
		this.runs = [];
		this.resetDraft();
	}

	/** An empty add form, and no project detail. */
	private resetDraft(): void {
		this.detailRead?.unsubscribe();
		this.detailRead = null;
		this.detail = null;
		this.detailLoading = false;
		this.draft = this.emptyDraft();
	}

	private emptyDraft(): MappingDraft {
		return {
			jiraProjectId: '',
			projectId: '',
			direction: 'inbound',
			syncEnabled: true,
			categories: { ...DEFAULT_JIRA_STATUS_MAP },
			named: {},
			issueTypeIds: []
		};
	}

	/** A confirmation or a notice: the same bundle the template's pipe reads. */
	private translateKey(key: string): string {
		return this.translate.instant(key);
	}
}
