import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, distinctUntilChanged, forkJoin, interval, map, of, catchError, Observable, switchMap } from 'rxjs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';
import { ASANA_LINK } from '../../integration-asana-ui.plugin';
import {
	AsanaConnectionSummary,
	AsanaDirection,
	AsanaMapping,
	AsanaMappingInput,
	AsanaProject,
	AsanaRun,
	AsanaSection,
	AsanaUiService,
	AsanaWorkspace
} from '../../services/asana-ui.service';
import { errorText, sectionMapOf } from '../shared/asana-ui.utils';
import { AsanaConflictsComponent } from '../conflicts/asana-conflicts.component';

/**
 * Whether the newer runs read holds a run that finished since the older one: one that was running and is not any
 * more (done, failed, or gone from the list), or one first seen already finished with conflicts (it started and ended
 * between two reads).
 */
export function finishedRuns(before: readonly AsanaRun[], after: readonly AsanaRun[]): boolean {
	const earlier = new Set(before.map((run) => run.id));
	const now = new Map(after.map((run) => [run.id, run.status]));
	if (before.some((run) => run.status === 'running' && now.get(run.id) !== 'running')) return true;
	return after.some((run) => !earlier.has(run.id) && run.status !== 'running' && (run.conflictCount ?? 0) > 0);
}

const DIRECTIONS: AsanaDirection[] = ['inbound', 'outbound', 'both'];
/** How often the runs are read again while one is running. */
const RUNS_POLL_MS = 10_000;

/** One section of the Asana project chosen in the add form, and the task status its tasks get (blank: by the section's name). */
interface SectionEntry {
	gid: string;
	name: string;
	status: string;
}

/** The add-mapping form. */
interface MappingDraft {
	asanaWorkspaceGid: string;
	asanaProjectGid: string;
	projectId: string;
	direction: AsanaDirection;
	syncEnabled: boolean;
	sections: SectionEntry[];
}

/**
 * The settings of an Asana connection: the account it is (and a way to disconnect), the Asana project ↔ project
 * mappings (add with a section → status map, change the direction or the switch, register the webhook again,
 * import now, remove), the sync conflicts
 * to resolve, and the latest runs with how many conflicts each found (a count opens the conflicts of its run).
 */
/** A mapping as the list shows it: the stored mapping and how many refused changes its row took (see `restore`). */
type AsanaMappingRow = AsanaMapping & { rowVersion?: number };

@Component({
	selector: 'ngx-asana-settings',
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
		AsanaConflictsComponent
	],
	template: `
		<nb-card>
			<nb-card-header class="header">
				<span>{{ 'ASANA.SETTINGS.TITLE' | translate }}</span>
				<button nbButton ghost size="small" type="button" data-test="back" (click)="back()">{{ 'ASANA.COMMON.BACK' | translate }}</button>
			</nb-card-header>
			<nb-card-body>
				@if (error) {
					<nb-alert status="danger" role="alert" data-test="error">{{ error }}</nb-alert>
				}
				@if (notice) {
					<nb-alert status="success" data-test="notice">{{ notice }}</nb-alert>
				}
				@if (loading) {
					<p data-test="loading">{{ 'ASANA.LOADING' | translate }}</p>
				} @else if (connection) {
					<section>
						<h5>{{ 'ASANA.SETTINGS.OVERVIEW' | translate }}</h5>
						@if (connection.attentionReason) {
							<nb-alert status="warning" role="alert" data-test="attention">
								{{ 'ASANA.CONNECTED.ATTENTION' | translate: { reason: ('ASANA.CONNECTED.REASONS.' + connection.attentionReason | translate) } }}
							</nb-alert>
						}
						<dl class="facts">
							<dt>{{ 'ASANA.CONNECTED.ACCOUNT' | translate }}</dt>
							<dd data-test="account">{{ connection.asanaUserName || connection.asanaUserEmail || '—' }}</dd>
							<dt>{{ 'ASANA.CONNECTED.CONNECTED_ON' | translate }}</dt>
							<dd>{{ connection.createdAt ? (connection.createdAt | date: 'medium') : '—' }}</dd>
							<dt>{{ 'ASANA.SETTINGS.WEBHOOKS' | translate }}</dt>
							<dd data-test="webhooks">{{ (webhooks ? 'ASANA.SETTINGS.WEBHOOKS_ON' : 'ASANA.SETTINGS.WEBHOOKS_OFF') | translate }}</dd>
						</dl>
						<button nbButton status="danger" ghost size="small" type="button" data-test="disconnect" [disabled]="busy" (click)="disconnect()">
							{{ 'ASANA.SETTINGS.DISCONNECT' | translate }}
						</button>
					</section>

					<section class="mappings">
						<h5>{{ 'ASANA.MAPPINGS.TITLE' | translate }}</h5>
						<p class="intro">{{ 'ASANA.MAPPINGS.INTRO' | translate }}</p>
						@if (!mappings.length) {
							<p data-test="no-mappings">{{ 'ASANA.MAPPINGS.EMPTY' | translate }}</p>
						} @else {
							<table class="table" data-test="mappings">
								<thead>
									<tr>
										<th>{{ 'ASANA.MAPPINGS.ASANA_PROJECT' | translate }}</th>
										<th>{{ 'ASANA.MAPPINGS.PROJECT' | translate }}</th>
										<th>{{ 'ASANA.MAPPINGS.DIRECTION' | translate }}</th>
										<th>{{ 'ASANA.MAPPINGS.SYNC' | translate }}</th>
										@if (webhooks) {
											<th>{{ 'ASANA.MAPPINGS.WEBHOOK' | translate }}</th>
										}
										<th>{{ 'ASANA.MAPPINGS.LAST_IMPORT' | translate }}</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									@for (mapping of mappings; track rowKey(mapping)) {
										<tr [attr.data-test]="'mapping-' + mapping.id">
											<td>
												<strong>{{ mapping.asanaProjectName || mapping.asanaProjectGid }}</strong>
												@if (sectionCount(mapping) > 0) {
													<small class="note">{{ 'ASANA.MAPPINGS.SECTIONS_MAPPED' | translate: { count: sectionCount(mapping) } }}</small>
												}
											</td>
											<td>{{ projectName(mapping.projectId) }}</td>
											<td>
												<nb-select size="small" [selected]="mapping.direction" [disabled]="busy" (selectedChange)="changeDirection(mapping, $event)">
													@for (direction of directions; track direction) {
														<nb-option [value]="direction">{{ 'ASANA.MAPPINGS.DIRECTIONS.' + direction | translate }}</nb-option>
													}
												</nb-select>
											</td>
											<td>
												<nb-checkbox [checked]="mapping.syncEnabled" [disabled]="busy" (checkedChange)="changeSync(mapping, $event)">
													{{ (mapping.syncEnabled ? 'ASANA.MAPPINGS.ENABLED' : 'ASANA.MAPPINGS.DISABLED') | translate }}
												</nb-checkbox>
											</td>
											@if (webhooks) {
												<td>
													@if (mapping.hasWebhook) {
														<span data-test="webhook-on">{{ 'ASANA.MAPPINGS.WEBHOOK_ON' | translate }}</span>
													} @else {
														<button nbButton size="tiny" ghost type="button" data-test="register-webhook" [disabled]="busy" (click)="registerWebhook(mapping)">
															{{ 'ASANA.MAPPINGS.WEBHOOK_REGISTER' | translate }}
														</button>
													}
												</td>
											}
											<td>
												{{ mapping.lastImportedAt ? (mapping.lastImportedAt | date: 'medium') : ('ASANA.COMMON.NEVER' | translate) }}
												@if (mapping.lastError) {
													<small class="note" [attr.title]="mapping.lastError">{{ 'ASANA.MAPPINGS.LAST_ERROR' | translate }}: {{ mapping.lastError }}</small>
												}
											</td>
											<td class="actions">
												<button nbButton size="tiny" status="primary" type="button" [disabled]="busy || !canImport(mapping)" (click)="importNow(mapping, false)">
													{{ 'ASANA.MAPPINGS.IMPORT' | translate }}
												</button>
												<button nbButton size="tiny" ghost type="button" [disabled]="busy || !canImport(mapping)" (click)="importNow(mapping, true)">
													{{ 'ASANA.MAPPINGS.IMPORT_FULL' | translate }}
												</button>
												<button nbButton size="tiny" ghost status="danger" type="button" [disabled]="busy" (click)="remove(mapping)">
													{{ 'ASANA.COMMON.REMOVE' | translate }}
												</button>
											</td>
										</tr>
									}
								</tbody>
							</table>
						}

						<form class="add" (ngSubmit)="add()" data-test="add-form">
							<h6>{{ 'ASANA.MAPPINGS.ADD' | translate }}</h6>
							@if (!workspaces.length) {
								<p data-test="no-workspaces">{{ 'ASANA.MAPPINGS.NO_WORKSPACES' | translate }}</p>
							}
							<div class="row">
								<label>
									<span>{{ 'ASANA.MAPPINGS.WORKSPACE' | translate }}</span>
									<nb-select fullWidth [selected]="draft.asanaWorkspaceGid" [disabled]="busy || !workspaces.length" (selectedChange)="chooseWorkspace($event)" data-test="workspace">
										@for (workspace of workspaces; track workspace.gid) {
											<nb-option [value]="workspace.gid">{{ workspace.name }}</nb-option>
										}
									</nb-select>
								</label>
								<label>
									<span>{{ 'ASANA.MAPPINGS.ASANA_PROJECT' | translate }}</span>
									<nb-select fullWidth [selected]="draft.asanaProjectGid" [disabled]="busy || !draft.asanaWorkspaceGid || loadingProjects" (selectedChange)="chooseAsanaProject($event)" data-test="asana-project">
										@for (project of unmappedAsanaProjects(); track project.gid) {
											<nb-option [value]="project.gid">{{ project.name }}</nb-option>
										}
									</nb-select>
									@if (loadingProjects) {
										<small class="note">{{ 'ASANA.LOADING' | translate }}</small>
									} @else if (draft.asanaWorkspaceGid && !unmappedAsanaProjects().length) {
										<small class="note" data-test="no-projects">{{ 'ASANA.MAPPINGS.NO_PROJECTS' | translate }}</small>
									}
								</label>
								<label>
									<span>{{ 'ASANA.MAPPINGS.PROJECT' | translate }}</span>
									<nb-select fullWidth [(selected)]="draft.projectId" [disabled]="busy" data-test="project">
										@for (project of projects; track project.id) {
											<nb-option [value]="project.id">{{ project.name }}</nb-option>
										}
									</nb-select>
								</label>
								<label>
									<span>{{ 'ASANA.MAPPINGS.DIRECTION' | translate }}</span>
									<nb-select fullWidth [(selected)]="draft.direction" [disabled]="busy" data-test="direction">
										@for (direction of directions; track direction) {
											<nb-option [value]="direction">{{ 'ASANA.MAPPINGS.DIRECTIONS.' + direction | translate }}</nb-option>
										}
									</nb-select>
								</label>
							</div>
							@if (draft.asanaProjectGid) {
								<fieldset class="section-map" data-test="section-map">
									<legend>{{ 'ASANA.MAPPINGS.SECTION_MAP' | translate }}</legend>
									<small class="note">{{ 'ASANA.MAPPINGS.SECTION_MAP_HINT' | translate }}</small>
									@if (loadingSections) {
										<p>{{ 'ASANA.LOADING' | translate }}</p>
									} @else if (!draft.sections.length) {
										<p data-test="no-sections">{{ 'ASANA.MAPPINGS.NO_SECTIONS' | translate }}</p>
									} @else {
										<div class="row">
											@for (entry of draft.sections; track entry.gid) {
												<label>
													<span>{{ entry.name }}</span>
													<input nbInput fullWidth fieldSize="small" [name]="'section-' + entry.gid" [(ngModel)]="entry.status" [disabled]="busy" [placeholder]="'ASANA.MAPPINGS.SECTION_BY_NAME' | translate" />
												</label>
											}
										</div>
									}
								</fieldset>
							}
							<nb-checkbox [(checked)]="draft.syncEnabled" [disabled]="busy">{{ 'ASANA.MAPPINGS.SYNC' | translate }}</nb-checkbox>
							<div class="submit">
								<button nbButton status="primary" type="submit" data-test="add" [disabled]="busy || !draft.asanaProjectGid || !draft.projectId">
									{{ (busy ? 'ASANA.MAPPINGS.ADDING' : 'ASANA.COMMON.SAVE') | translate }}
								</button>
							</div>
						</form>
					</section>

					<section class="conflicts">
						<ngx-asana-conflicts [integrationId]="connection.id" [(runId)]="conflictRunId" />
					</section>

					<section class="runs">
						<h5>
							{{ 'ASANA.RUNS.TITLE' | translate }}
							<button nbButton ghost size="tiny" type="button" data-test="refresh-runs" (click)="loadRuns()">{{ 'ASANA.COMMON.REFRESH' | translate }}</button>
						</h5>
						@if (!runs.length) {
							<p data-test="no-runs">{{ 'ASANA.RUNS.EMPTY' | translate }}</p>
						} @else {
							<table class="table" data-test="runs">
								<thead>
									<tr>
										<th>{{ 'ASANA.RUNS.KIND' | translate }}</th>
										<th>{{ 'ASANA.RUNS.STATUS' | translate }}</th>
										<th>{{ 'ASANA.RUNS.STARTED' | translate }}</th>
										<th>{{ 'ASANA.RUNS.FINISHED' | translate }}</th>
										<th>{{ 'ASANA.RUNS.COUNTS' | translate }}</th>
										<th>{{ 'ASANA.RUNS.CONFLICTS' | translate }}</th>
										<th>{{ 'ASANA.RUNS.ERROR' | translate }}</th>
									</tr>
								</thead>
								<tbody>
									@for (run of runs; track run.id) {
										<tr>
											<td>{{ 'ASANA.RUNS.KINDS.' + run.kind | translate }}{{ run.full ? ' ' + ('ASANA.RUNS.FULL' | translate) : '' }}</td>
											<td>{{ 'ASANA.RUNS.STATUSES.' + run.status | translate }}</td>
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
														[attr.title]="'ASANA.RUNS.SHOW_CONFLICTS' | translate"
														(click)="showRunConflicts(run)"
													>
														{{ run.conflictCount }}
													</button>
												} @else {
													0
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
			.section-map {
				border: 1px solid var(--divider-color);
				border-radius: var(--border-radius);
				padding: 8px 16px 16px;
				margin: 16px 0;
			}
			.actions button {
				margin-right: 0.25rem;
			}
			.submit {
				margin-top: 1rem;
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
export class AsanaSettingsComponent implements OnInit {
	private readonly api = inject(AsanaUiService);
	private readonly projectsService = inject(OrganizationProjectsService);
	private readonly translate = inject(TranslateService);
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	/** The conflict list (read again when a run finishes) and its host (scrolled to when a run's count opens it). */
	@ViewChild(AsanaConflictsComponent) private readonly conflictList?: AsanaConflictsComponent;
	@ViewChild(AsanaConflictsComponent, { read: ElementRef }) private readonly conflictHost?: ElementRef<HTMLElement>;

	readonly directions = DIRECTIONS;

	integrationId: string | null = null;
	organizationId: string | null = null;
	connection: AsanaConnectionSummary | null = null;
	/** Whether the server has a public address for webhooks (the column and the register button show only then). */
	webhooks = false;
	workspaces: AsanaWorkspace[] = [];
	asanaProjects: AsanaProject[] = [];
	projects: IOrganizationProject[] = [];
	mappings: AsanaMappingRow[] = [];
	runs: AsanaRun[] = [];
	/** The run whose conflicts the list shows (a run's count in the sync log sets it); null: every run. */
	conflictRunId: string | null = null;
	draft: MappingDraft = this.emptyDraft();
	loading = true;
	loadingProjects = false;
	loadingSections = false;
	busy = false;
	error: string | null = null;
	notice: string | null = null;

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
					// Another connection: the run filter of the last one means nothing here.
					if (integrationId !== this.integrationId) this.conflictRunId = null;
					this.integrationId = integrationId;
					this.organizationId = organizationId;
					this.loading = true;
					this.error = null;
					this.cdr.markForCheck();
					if (!integrationId || !organizationId) return of(null);
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
	}

	/** The connection, the server's status (webhooks), the workspaces, the organization's projects, the mappings and the runs, together. */
	private load(integrationId: string, organizationId: string): Observable<unknown> {
		const tenantId = this.store.selectedOrganization?.tenantId;
		return forkJoin({
			connection: this.api.summary(integrationId),
			status: this.api.status(organizationId).pipe(catchError((error) => this.fail(error, null))),
			metadata: this.api.metadata(integrationId).pipe(catchError((error) => this.fail(error, null))),
			projects: this.projectsService
				.getAll([], { organizationId, tenantId } as never)
				.then((page) => page.items)
				.catch((error) => this.failed(error, [])),
			mappings: this.api.mappings(integrationId),
			runs: this.api.runs(integrationId).pipe(catchError((error) => this.fail(error, [])))
		}).pipe(
			map((result) => {
				this.connection = result.connection;
				this.webhooks = result.status?.webhooks ?? false;
				this.workspaces = result.metadata?.workspaces ?? [];
				this.projects = result.projects;
				this.mappings = result.mappings;
				this.runs = result.runs;
				this.draft = this.emptyDraft();
				this.asanaProjects = [];
				// One workspace: chosen at once, its projects loaded.
				if (this.workspaces.length === 1) this.chooseWorkspace(this.workspaces[0].gid);
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
				// A run that just finished (another may still run) may have found conflicts.
				if (finished) this.conflictList?.load(true);
				this.cdr.markForCheck();
			},
			error: () => undefined
		});
	}

	/** The sync log's count of a run: the conflict list shows what that run found. */
	showRunConflicts(run: AsanaRun): void {
		this.conflictRunId = run.id;
		this.cdr.markForCheck();
		this.conflictHost?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
	}

	loadMappings(): void {
		if (!this.integrationId) return;
		this.api.mappings(this.integrationId).subscribe({
			next: (mappings) => {
				this.mappings = mappings;
				this.cdr.markForCheck();
			},
			error: (error) => this.showError(error)
		});
	}

	/** A workspace chosen in the add form: its projects are read, the project and sections cleared. */
	chooseWorkspace(workspaceGid: string): void {
		if (!this.integrationId) return;
		this.draft = { ...this.emptyDraft(), asanaWorkspaceGid: workspaceGid, projectId: this.draft.projectId, direction: this.draft.direction, syncEnabled: this.draft.syncEnabled };
		this.asanaProjects = [];
		if (!workspaceGid) {
			// Nothing chosen: no read is awaited, and an earlier one's answer is dropped by the guard below.
			this.loadingProjects = false;
			this.cdr.markForCheck();
			return;
		}
		this.loadingProjects = true;
		this.cdr.markForCheck();
		this.api.projects(this.integrationId, workspaceGid).subscribe({
			// An answer for a workspace no longer chosen is dropped: the list and the flag follow the current one.
			next: (projects) => {
				if (this.draft.asanaWorkspaceGid !== workspaceGid) return;
				this.loadingProjects = false;
				this.asanaProjects = projects;
				this.cdr.markForCheck();
			},
			error: (error) => {
				if (this.draft.asanaWorkspaceGid !== workspaceGid) return;
				this.loadingProjects = false;
				this.showError(error);
			}
		});
	}

	/** An Asana project chosen in the add form: its sections are read for the section map. */
	chooseAsanaProject(projectGid: string): void {
		if (!this.integrationId) return;
		this.draft = { ...this.draft, asanaProjectGid: projectGid, sections: [] };
		if (!projectGid) {
			this.loadingSections = false;
			this.cdr.markForCheck();
			return;
		}
		this.loadingSections = true;
		this.cdr.markForCheck();
		this.api.sections(this.integrationId, projectGid).subscribe({
			next: (sections: AsanaSection[]) => {
				if (this.draft.asanaProjectGid !== projectGid) return;
				this.loadingSections = false;
				this.draft = { ...this.draft, sections: sections.map((section) => ({ gid: section.gid, name: section.name, status: '' })) };
				this.cdr.markForCheck();
			},
			error: (error) => {
				if (this.draft.asanaProjectGid !== projectGid) return;
				this.loadingSections = false;
				this.showError(error);
			}
		});
	}

	/** The Asana projects of the chosen workspace not mapped yet (the add form offers those). */
	unmappedAsanaProjects(): AsanaProject[] {
		const mapped = new Set(this.mappings.map((mapping) => mapping.asanaProjectGid));
		return this.asanaProjects.filter((project) => !mapped.has(project.gid));
	}

	projectName(projectId: string): string {
		return this.projects.find((project) => project.id === projectId)?.name ?? projectId;
	}

	sectionCount(mapping: AsanaMapping): number {
		return Object.keys(mapping.sectionMap ?? {}).length;
	}

	add(): void {
		if (!this.integrationId || !this.draft.asanaWorkspaceGid || !this.draft.asanaProjectGid || !this.draft.projectId || this.busy) return;
		const asanaProject = this.asanaProjects.find((item) => item.gid === this.draft.asanaProjectGid);
		const input: AsanaMappingInput = {
			asanaWorkspaceGid: this.draft.asanaWorkspaceGid,
			asanaProjectGid: this.draft.asanaProjectGid,
			asanaProjectName: asanaProject?.name ?? null,
			projectId: this.draft.projectId,
			direction: this.draft.direction,
			syncEnabled: this.draft.syncEnabled,
			sectionMap: sectionMapOf(this.draft.sections)
		};
		this.request(this.api.createMapping(this.integrationId, input), () => {
			const workspaceGid = this.draft.asanaWorkspaceGid;
			this.draft = { ...this.emptyDraft(), asanaWorkspaceGid: workspaceGid };
			this.loadMappings();
		});
	}

	changeDirection(mapping: AsanaMapping, direction: AsanaDirection): void {
		if (!this.integrationId || direction === mapping.direction) return;
		// Refused (a project that already sends its tasks elsewhere, for one): the row shows the stored direction again.
		this.request(this.api.updateMapping(this.integrationId, mapping.id, { direction }), (updated) => this.replace(updated), () => this.restore(mapping));
	}

	changeSync(mapping: AsanaMapping, syncEnabled: boolean): void {
		if (!this.integrationId || syncEnabled === mapping.syncEnabled) return;
		this.request(this.api.updateMapping(this.integrationId, mapping.id, { syncEnabled }), (updated) => this.replace(updated), () => this.restore(mapping));
	}

	registerWebhook(mapping: AsanaMapping): void {
		if (!this.integrationId) return;
		this.request(this.api.registerWebhook(this.integrationId, mapping.id), () => {
			this.notice = this.translateKey('ASANA.MAPPINGS.WEBHOOK_REQUESTED');
			// Registered behind the response: the list is read again shortly.
			setTimeout(() => this.loadMappings(), 3000);
		});
	}

	/** Whether the API would import this mapping now: switched on and not outbound (the route's own rule). */
	canImport(mapping: AsanaMapping): boolean {
		return !!mapping.syncEnabled && String(mapping.direction) !== 'outbound';
	}

	importNow(mapping: AsanaMapping, full: boolean): void {
		if (!this.integrationId) return;
		this.request(this.api.importNow(this.integrationId, mapping.id, full), () => {
			this.notice = this.translateKey('ASANA.MAPPINGS.IMPORT_STARTED');
			this.loadRuns();
		});
	}

	remove(mapping: AsanaMapping): void {
		if (!this.integrationId || !window.confirm(this.translateKey('ASANA.MAPPINGS.REMOVE_CONFIRM'))) return;
		this.request(this.api.removeMapping(this.integrationId, mapping.id), () => this.loadMappings());
	}

	disconnect(): void {
		if (!this.integrationId || !window.confirm(this.translateKey('ASANA.SETTINGS.DISCONNECT_CONFIRM'))) return;
		this.request(this.api.disconnect(this.integrationId), () => void this.router.navigate([ASANA_LINK]));
	}

	back(): void {
		void this.router.navigate([ASANA_LINK]);
	}


	/** One request at a time: `apply` takes its answer; `revert` puts the page back when it was refused. */
	private request<T>(request: Observable<T>, apply: (value: T) => void, revert?: () => void): void {
		this.busy = true;
		this.error = null;
		this.notice = null;
		this.cdr.markForCheck();
		request.subscribe({
			next: (value) => {
				this.busy = false;
				apply(value);
				this.cdr.markForCheck();
			},
			error: (error) => {
				this.busy = false;
				revert?.();
				this.showError(error);
			}
		});
	}

	private replace(updated: AsanaMapping, rowVersion?: number): void {
		this.mappings = this.mappings.map((mapping) => (mapping.id === updated.id ? { ...updated, rowVersion: rowVersion ?? mapping.rowVersion } : mapping));
	}

	/** A row's identity for the list: its mapping, and how many refused changes it took (each one re-creates the row); the count is the row's own. */
	rowKey(mapping: AsanaMappingRow): string {
		return `${mapping.id}:${mapping.rowVersion ?? 0}`;
	}

	/**
	 * Puts a row back as it is stored after a refused change. Replacing the mapping alone is not enough: the bound
	 * values did not change, so the select and the checkbox keep the choice the person made; the row's key changes
	 * instead, and the list re-creates the row with the stored values.
	 */
	private restore(mapping: AsanaMapping): void {
		const current = this.mappings.find((row) => row.id === mapping.id);
		this.replace(mapping, (current?.rowVersion ?? 0) + 1);
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

	private emptyDraft(): MappingDraft {
		return { asanaWorkspaceGid: '', asanaProjectGid: '', projectId: '', direction: 'inbound', syncEnabled: true, sections: [] };
	}

	/** A confirmation or a notice: the same bundle the template's pipe reads. */
	private translateKey(key: string): string {
		return this.translate.instant(key);
	}
}
