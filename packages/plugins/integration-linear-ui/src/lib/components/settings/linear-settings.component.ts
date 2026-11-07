import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, distinctUntilChanged, forkJoin, interval, map, of, catchError, Observable, switchMap } from 'rxjs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';
import { LINEAR_LINK } from '../../integration-linear-ui.plugin';
import {
	LinearConnectionSummary,
	LinearDirection,
	LinearMapping,
	LinearMappingInput,
	LinearRun,
	LinearTeam,
	LinearUiService
} from '../../services/linear-ui.service';
import { errorText, LINEAR_STATE_KINDS, LinearStateKind } from '../shared/linear-ui.utils';

/** The task status each Linear state kind becomes unless the mapping says otherwise (the API's defaults). */
const DEFAULT_STATE_MAP: Record<LinearStateKind, string> = {
	triage: 'open',
	backlog: 'backlog',
	unstarted: 'open',
	started: 'in-progress',
	completed: 'completed',
	canceled: 'cancelled'
};

const DIRECTIONS: LinearDirection[] = ['inbound', 'outbound', 'both'];
/** How often the runs are read again while one is running. */
const RUNS_POLL_MS = 10_000;

/** The add-mapping form. */
interface MappingDraft {
	linearTeamId: string;
	projectId: string;
	direction: LinearDirection;
	syncEnabled: boolean;
	stateMap: Record<LinearStateKind, string>;
}

/**
 * The settings of a Linear connection: the workspace it opens (and a way to disconnect), the team ↔ project
 * mappings (add, change the direction or the switch, import now, remove), and the latest runs.
 */
@Component({
	selector: 'ngx-linear-settings',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, FormsModule, NbAlertModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, NbSelectModule, TranslatePipe],
	template: `
		<nb-card>
			<nb-card-header class="header">
				<span>{{ 'LINEAR.SETTINGS.TITLE' | translate }}</span>
				<button nbButton ghost size="small" type="button" data-test="back" (click)="back()">{{ 'LINEAR.COMMON.BACK' | translate }}</button>
			</nb-card-header>
			<nb-card-body>
				@if (error) {
					<nb-alert status="danger" role="alert" data-test="error">{{ error }}</nb-alert>
				}
				@if (notice) {
					<nb-alert status="success" data-test="notice">{{ notice }}</nb-alert>
				}
				@if (loading) {
					<p data-test="loading">{{ 'LINEAR.LOADING' | translate }}</p>
				} @else if (connection) {
					<section>
						<h5>{{ 'LINEAR.SETTINGS.OVERVIEW' | translate }}</h5>
						@if (connection.attentionReason) {
							<nb-alert status="warning" role="alert" data-test="attention">
								{{ 'LINEAR.CONNECTED.ATTENTION' | translate: { reason: ('LINEAR.CONNECTED.REASONS.' + connection.attentionReason | translate) } }}
							</nb-alert>
						}
						<dl class="facts">
							<dt>{{ 'LINEAR.CONNECTED.WORKSPACE' | translate }}</dt>
							<dd data-test="workspace">{{ connection.linearOrganizationName || connection.linearOrganizationUrlKey || '—' }}</dd>
							<dt>{{ 'LINEAR.CONNECTED.CONNECTED_ON' | translate }}</dt>
							<dd>{{ connection.createdAt ? (connection.createdAt | date: 'medium') : '—' }}</dd>
						</dl>
						<button nbButton status="danger" ghost size="small" type="button" data-test="disconnect" [disabled]="busy" (click)="disconnect()">
							{{ 'LINEAR.SETTINGS.DISCONNECT' | translate }}
						</button>
					</section>

					<section class="mappings">
						<h5>{{ 'LINEAR.MAPPINGS.TITLE' | translate }}</h5>
						<p class="intro">{{ 'LINEAR.MAPPINGS.INTRO' | translate }}</p>
						@if (!mappings.length) {
							<p data-test="no-mappings">{{ 'LINEAR.MAPPINGS.EMPTY' | translate }}</p>
						} @else {
							<table class="table" data-test="mappings">
								<thead>
									<tr>
										<th>{{ 'LINEAR.MAPPINGS.TEAM' | translate }}</th>
										<th>{{ 'LINEAR.MAPPINGS.PROJECT' | translate }}</th>
										<th>{{ 'LINEAR.MAPPINGS.DIRECTION' | translate }}</th>
										<th>{{ 'LINEAR.MAPPINGS.SYNC' | translate }}</th>
										<th>{{ 'LINEAR.MAPPINGS.LAST_IMPORT' | translate }}</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									@for (mapping of mappings; track mapping.id) {
										<tr [attr.data-test]="'mapping-' + mapping.id">
											<td>
												<strong>{{ mapping.linearTeamKey || '' }}</strong> {{ mapping.linearTeamName || mapping.linearTeamId }}
											</td>
											<td>{{ projectName(mapping.projectId) }}</td>
											<td>
												<nb-select size="small" [selected]="mapping.direction" [disabled]="busy" (selectedChange)="changeDirection(mapping, $event)">
													@for (direction of directions; track direction) {
														<nb-option [value]="direction">{{ 'LINEAR.MAPPINGS.DIRECTIONS.' + direction | translate }}</nb-option>
													}
												</nb-select>
											</td>
											<td>
												<nb-checkbox [checked]="mapping.syncEnabled" [disabled]="busy" (checkedChange)="changeSync(mapping, $event)">
													{{ (mapping.syncEnabled ? 'LINEAR.MAPPINGS.ENABLED' : 'LINEAR.MAPPINGS.DISABLED') | translate }}
												</nb-checkbox>
											</td>
											<td>
												{{ mapping.lastImportedAt ? (mapping.lastImportedAt | date: 'medium') : ('LINEAR.COMMON.NEVER' | translate) }}
												@if (mapping.lastError) {
													<small class="note" [attr.title]="mapping.lastError">{{ 'LINEAR.MAPPINGS.LAST_ERROR' | translate }}: {{ mapping.lastError }}</small>
												}
											</td>
											<td class="actions">
												<button nbButton size="tiny" status="primary" type="button" [disabled]="busy" (click)="importNow(mapping, false)">
													{{ 'LINEAR.MAPPINGS.IMPORT' | translate }}
												</button>
												<button nbButton size="tiny" ghost type="button" [disabled]="busy" (click)="importNow(mapping, true)">
													{{ 'LINEAR.MAPPINGS.IMPORT_FULL' | translate }}
												</button>
												<button nbButton size="tiny" ghost status="danger" type="button" [disabled]="busy" (click)="remove(mapping)">
													{{ 'LINEAR.COMMON.REMOVE' | translate }}
												</button>
											</td>
										</tr>
									}
								</tbody>
							</table>
						}

						<form class="add" (ngSubmit)="add()" data-test="add-form">
							<h6>{{ 'LINEAR.MAPPINGS.ADD' | translate }}</h6>
							@if (!teams.length) {
								<p data-test="no-teams">{{ 'LINEAR.MAPPINGS.NO_TEAMS' | translate }}</p>
							}
							<div class="row">
								<label>
									<span>{{ 'LINEAR.MAPPINGS.TEAM' | translate }}</span>
									<nb-select fullWidth [(selected)]="draft.linearTeamId" [disabled]="busy || !teams.length" data-test="team">
										@for (team of unmappedTeams(); track team.id) {
											<nb-option [value]="team.id">{{ team.key }} · {{ team.name }}</nb-option>
										}
									</nb-select>
								</label>
								<label>
									<span>{{ 'LINEAR.MAPPINGS.PROJECT' | translate }}</span>
									<nb-select fullWidth [(selected)]="draft.projectId" [disabled]="busy" data-test="project">
										@for (project of projects; track project.id) {
											<nb-option [value]="project.id">{{ project.name }}</nb-option>
										}
									</nb-select>
								</label>
								<label>
									<span>{{ 'LINEAR.MAPPINGS.DIRECTION' | translate }}</span>
									<nb-select fullWidth [(selected)]="draft.direction" [disabled]="busy" data-test="direction">
										@for (direction of directions; track direction) {
											<nb-option [value]="direction">{{ 'LINEAR.MAPPINGS.DIRECTIONS.' + direction | translate }}</nb-option>
										}
									</nb-select>
								</label>
							</div>
							<fieldset class="state-map">
								<legend>{{ 'LINEAR.MAPPINGS.STATE_MAP' | translate }}</legend>
								<small class="note">{{ 'LINEAR.MAPPINGS.STATE_MAP_HINT' | translate }}</small>
								<div class="row">
									@for (kind of stateKinds; track kind) {
										<label>
											<span>{{ 'LINEAR.MAPPINGS.STATE_KINDS.' + kind | translate }}</span>
											<input nbInput fullWidth fieldSize="small" [name]="'state-' + kind" [(ngModel)]="draft.stateMap[kind]" [disabled]="busy" />
										</label>
									}
								</div>
							</fieldset>
							<nb-checkbox [(checked)]="draft.syncEnabled" [disabled]="busy">{{ 'LINEAR.MAPPINGS.SYNC' | translate }}</nb-checkbox>
							<div class="submit">
								<button nbButton status="primary" type="submit" data-test="add" [disabled]="busy || !draft.linearTeamId || !draft.projectId">
									{{ (busy ? 'LINEAR.MAPPINGS.ADDING' : 'LINEAR.COMMON.SAVE') | translate }}
								</button>
							</div>
						</form>
					</section>

					<section class="runs">
						<h5>
							{{ 'LINEAR.RUNS.TITLE' | translate }}
							<button nbButton ghost size="tiny" type="button" data-test="refresh-runs" (click)="loadRuns()">{{ 'LINEAR.COMMON.REFRESH' | translate }}</button>
						</h5>
						@if (!runs.length) {
							<p data-test="no-runs">{{ 'LINEAR.RUNS.EMPTY' | translate }}</p>
						} @else {
							<table class="table" data-test="runs">
								<thead>
									<tr>
										<th>{{ 'LINEAR.RUNS.KIND' | translate }}</th>
										<th>{{ 'LINEAR.RUNS.STATUS' | translate }}</th>
										<th>{{ 'LINEAR.RUNS.STARTED' | translate }}</th>
										<th>{{ 'LINEAR.RUNS.FINISHED' | translate }}</th>
										<th>{{ 'LINEAR.RUNS.COUNTS' | translate }}</th>
										<th>{{ 'LINEAR.RUNS.ERROR' | translate }}</th>
									</tr>
								</thead>
								<tbody>
									@for (run of runs; track run.id) {
										<tr>
											<td>{{ 'LINEAR.RUNS.KINDS.' + run.kind | translate }}{{ run.full ? ' (full)' : '' }}</td>
											<td>{{ 'LINEAR.RUNS.STATUSES.' + run.status | translate }}</td>
											<td>{{ run.startedAt ? (run.startedAt | date: 'short') : '—' }}</td>
											<td>{{ run.finishedAt ? (run.finishedAt | date: 'short') : '—' }}</td>
											<td>{{ run.createdCount }} / {{ run.updatedCount }} / {{ run.skippedCount }} / {{ run.failedCount }}</td>
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
			.state-map {
				border: 1px solid rgba(143, 155, 179, 0.3);
				border-radius: 0.5rem;
				padding: 0.5rem 1rem 1rem;
				margin: 1rem 0;
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
export class LinearSettingsComponent implements OnInit {
	private readonly api = inject(LinearUiService);
	private readonly projectsService = inject(OrganizationProjectsService);
	private readonly translate = inject(TranslateService);
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	readonly directions = DIRECTIONS;
	readonly stateKinds = LINEAR_STATE_KINDS;

	integrationId: string | null = null;
	organizationId: string | null = null;
	connection: LinearConnectionSummary | null = null;
	teams: LinearTeam[] = [];
	projects: IOrganizationProject[] = [];
	mappings: LinearMapping[] = [];
	runs: LinearRun[] = [];
	draft: MappingDraft = this.emptyDraft();
	loading = true;
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

	/** The connection, its teams, the organization's projects, the mappings and the runs, together. */
	private load(integrationId: string, organizationId: string): Observable<unknown> {
		const tenantId = this.store.selectedOrganization?.tenantId;
		return forkJoin({
			connection: this.api.summary(integrationId),
			teams: this.api.teams(integrationId).pipe(catchError((error) => this.fail(error, []))),
			projects: this.projectsService
				.getAll([], { organizationId, tenantId } as never)
				.then((page) => page.items)
				.catch((error) => this.failed(error, [])),
			mappings: this.api.mappings(integrationId),
			runs: this.api.runs(integrationId).pipe(catchError((error) => this.fail(error, [])))
		}).pipe(
			map((result) => {
				this.connection = result.connection;
				this.teams = result.teams;
				this.projects = result.projects;
				this.mappings = result.mappings;
				this.runs = result.runs;
				this.draft = this.emptyDraft();
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
		if (!this.integrationId) return;
		this.api.runs(this.integrationId).subscribe({
			next: (runs) => {
				this.runs = runs;
				this.cdr.markForCheck();
			},
			error: () => undefined
		});
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

	/** The teams not mapped yet (the add form offers those). */
	unmappedTeams(): LinearTeam[] {
		const mapped = new Set(this.mappings.map((mapping) => mapping.linearTeamId));
		return this.teams.filter((team) => !mapped.has(team.id));
	}

	projectName(projectId: string): string {
		return this.projects.find((project) => project.id === projectId)?.name ?? projectId;
	}

	add(): void {
		if (!this.integrationId || !this.draft.linearTeamId || !this.draft.projectId || this.busy) return;
		const team = this.teams.find((item) => item.id === this.draft.linearTeamId);
		const input: LinearMappingInput = {
			linearTeamId: this.draft.linearTeamId,
			linearTeamKey: team?.key ?? null,
			linearTeamName: team?.name ?? null,
			projectId: this.draft.projectId,
			direction: this.draft.direction,
			syncEnabled: this.draft.syncEnabled,
			stateMap: this.draft.stateMap
		};
		this.request(this.api.createMapping(this.integrationId, input), () => {
			this.draft = this.emptyDraft();
			this.loadMappings();
		});
	}

	changeDirection(mapping: LinearMapping, direction: LinearDirection): void {
		if (!this.integrationId || direction === mapping.direction) return;
		this.request(this.api.updateMapping(this.integrationId, mapping.id, { direction }), (updated) => this.replace(updated));
	}

	changeSync(mapping: LinearMapping, syncEnabled: boolean): void {
		if (!this.integrationId || syncEnabled === mapping.syncEnabled) return;
		this.request(this.api.updateMapping(this.integrationId, mapping.id, { syncEnabled }), (updated) => this.replace(updated));
	}

	importNow(mapping: LinearMapping, full: boolean): void {
		if (!this.integrationId) return;
		this.request(this.api.importNow(this.integrationId, mapping.id, full), () => {
			this.notice = this.translateKey('LINEAR.MAPPINGS.IMPORT_STARTED');
			this.loadRuns();
		});
	}

	remove(mapping: LinearMapping): void {
		if (!this.integrationId || !window.confirm(this.translateKey('LINEAR.MAPPINGS.REMOVE_CONFIRM'))) return;
		this.request(this.api.removeMapping(this.integrationId, mapping.id), () => this.loadMappings());
	}

	disconnect(): void {
		if (!this.integrationId || !window.confirm(this.translateKey('LINEAR.SETTINGS.DISCONNECT_CONFIRM'))) return;
		this.request(this.api.disconnect(this.integrationId), () => void this.router.navigate([LINEAR_LINK]));
	}

	back(): void {
		void this.router.navigate([LINEAR_LINK]);
	}

	/** One request with the busy flag and the error line. */
	private request<T>(request: Observable<T>, apply: (value: T) => void): void {
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
				this.showError(error);
			}
		});
	}

	private replace(updated: LinearMapping): void {
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

	private emptyDraft(): MappingDraft {
		return { linearTeamId: '', projectId: '', direction: 'inbound', syncEnabled: true, stateMap: { ...DEFAULT_STATE_MAP } };
	}

	/** A confirmation or a notice: the same bundle the template's pipe reads. */
	private translateKey(key: string): string {
		return this.translate.instant(key);
	}
}
