import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbInputModule,
	NbRadioModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ID, TaskViewVisibilityEnum } from '@gauzy/contracts';
import { TASK_VIEW_NAME_MAX } from '../../task-views-ui.constants';
import { normalizedViewName, TaskViewPlacement } from '../../models/view-definition';
import { TaskViewOption } from '../../services/task-views-options.service';

/** What the dialog asks: a new view, a copy of the open one, or a new name (and who sees it) for the open one. */
export type SaveViewDialogMode = 'create' | 'saveAs' | 'rename';

/** Where a shared view belongs. */
export type SharedScope = 'organization' | 'team' | 'project';

/** The placement the dialog answers, or nothing when it was cancelled. */
export type SaveViewDialogResult = TaskViewPlacement | null | undefined;

/**
 * The name of a view and who sees it: only me (personal), or shared with the organization, a team or a project.
 * Answers the placement; the page saves it.
 */
@Component({
	selector: 'ngx-task-views-save-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbInputModule, NbRadioModule, NbSelectModule, TranslatePipe],
	template: `
		<nb-card class="save-view-dialog" data-test="save-view-dialog">
			<nb-card-header>{{ titleKey() | translate }}</nb-card-header>
			<nb-card-body>
				<form (ngSubmit)="submit()" id="task-views-save-form">
					<label class="field">
						<span class="label">{{ 'TASK_VIEWS.DIALOG.NAME' | translate }}</span>
						<input
							nbInput
							fullWidth
							name="name"
							data-test="view-name"
							[maxlength]="nameMax"
							[placeholder]="'TASK_VIEWS.DIALOG.NAME_PLACEHOLDER' | translate"
							[ngModel]="name()"
							(ngModelChange)="name.set($event)"
							required
							autofocus
						/>
					</label>
					@if (submitted() && !validName()) {
						<p class="error" role="alert">{{ 'TASK_VIEWS.DIALOG.NAME_REQUIRED' | translate }}</p>
					}
					<fieldset class="field">
						<legend class="label">{{ 'TASK_VIEWS.DIALOG.VISIBILITY' | translate }}</legend>
						<nb-radio-group
							name="visibility"
							[ngModel]="visibility()"
							(ngModelChange)="visibility.set($event)"
						>
							<nb-radio [value]="personal" data-test="visibility-personal">{{
								'TASK_VIEWS.DIALOG.PERSONAL' | translate
							}}</nb-radio>
							<nb-radio [value]="shared" data-test="visibility-shared">{{
								'TASK_VIEWS.DIALOG.SHARED' | translate
							}}</nb-radio>
						</nb-radio-group>
					</fieldset>
					@if (visibility() === shared) {
						<div class="field shared-scope">
							<span class="label">{{ 'TASK_VIEWS.DIALOG.SHARED_WITH' | translate }}</span>
							<p class="hint">{{ 'TASK_VIEWS.DIALOG.SHARED_HINT' | translate }}</p>
							<nb-select
								fullWidth
								name="scope"
								[selected]="sharedScope()"
								(selectedChange)="sharedScope.set($event)"
							>
								<nb-option value="organization">{{
									'TASK_VIEWS.DIALOG.ORGANIZATION' | translate
								}}</nb-option>
								@if (teams.length) {
									<nb-option value="team">{{ 'TASK_VIEWS.DIALOG.TEAM' | translate }}</nb-option>
								}
								@if (projects.length) {
									<nb-option value="project">{{ 'TASK_VIEWS.DIALOG.PROJECT' | translate }}</nb-option>
								}
							</nb-select>
							@if (sharedScope() === 'team') {
								<nb-select
									fullWidth
									name="team"
									[placeholder]="'TASK_VIEWS.DIALOG.CHOOSE_TEAM' | translate"
									[selected]="teamId()"
									(selectedChange)="teamId.set($event)"
								>
									@for (team of teams; track team.id) {
										<nb-option [value]="team.id">{{ team.label }}</nb-option>
									}
								</nb-select>
							}
							@if (sharedScope() === 'project') {
								<nb-select
									fullWidth
									name="project"
									[placeholder]="'TASK_VIEWS.DIALOG.CHOOSE_PROJECT' | translate"
									[selected]="projectId()"
									(selectedChange)="projectId.set($event)"
								>
									@for (project of projects; track project.id) {
										<nb-option [value]="project.id">{{ project.label }}</nb-option>
									}
								</nb-select>
							}
							@if (submitted() && !validScope()) {
								<p class="error" role="alert">{{ 'TASK_VIEWS.DIALOG.SCOPE_REQUIRED' | translate }}</p>
							}
						</div>
					}
				</form>
			</nb-card-body>
			<nb-card-footer class="actions">
				<button nbButton status="basic" type="button" (click)="cancel()">
					{{ 'TASK_VIEWS.DIALOG.CANCEL' | translate }}
				</button>
				<button
					nbButton
					status="primary"
					type="submit"
					form="task-views-save-form"
					data-test="save-view-submit"
				>
					{{ (mode === 'rename' ? 'TASK_VIEWS.DIALOG.SAVE' : 'TASK_VIEWS.DIALOG.CREATE') | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.save-view-dialog {
				width: min(28rem, 92vw);
			}
			.field {
				display: block;
				margin: 0 0 1rem;
				border: 0;
				padding: 0;
			}
			.label {
				display: block;
				font-weight: 600;
				margin-bottom: 0.375rem;
			}
			.shared-scope nb-select + nb-select {
				margin-top: 0.5rem;
			}
			.hint {
				margin: 0 0 0.5rem;
				font-size: 0.8125rem;
				color: var(--text-hint-color);
			}
			.error {
				color: var(--color-danger-default);
				margin: -0.5rem 0 1rem;
				font-size: 0.875rem;
			}
			.actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class SaveViewDialogComponent implements OnInit {
	private readonly ref = inject(NbDialogRef<SaveViewDialogComponent>);

	@Input() mode: SaveViewDialogMode = 'create';
	@Input() initial: Partial<TaskViewPlacement> | null = null;
	@Input() teams: TaskViewOption[] = [];
	@Input() projects: TaskViewOption[] = [];

	protected readonly nameMax = TASK_VIEW_NAME_MAX;
	protected readonly personal = TaskViewVisibilityEnum.PERSONAL;
	protected readonly shared = TaskViewVisibilityEnum.SHARED;

	protected readonly name = signal('');
	protected readonly visibility = signal<TaskViewVisibilityEnum>(TaskViewVisibilityEnum.PERSONAL);
	protected readonly sharedScope = signal<SharedScope>('organization');
	protected readonly teamId = signal<ID | null>(null);
	protected readonly projectId = signal<ID | null>(null);
	protected readonly submitted = signal(false);

	ngOnInit(): void {
		const initial = this.initial ?? {};
		this.name.set(initial.name ?? '');
		this.visibility.set(initial.visibility ?? TaskViewVisibilityEnum.PERSONAL);
		this.teamId.set(initial.organizationTeamId ?? null);
		this.projectId.set(initial.projectId ?? null);
		this.sharedScope.set(initial.organizationTeamId ? 'team' : initial.projectId ? 'project' : 'organization');
	}

	protected titleKey(): string {
		return this.mode === 'rename'
			? 'TASK_VIEWS.DIALOG.RENAME_TITLE'
			: this.mode === 'saveAs'
				? 'TASK_VIEWS.DIALOG.SAVE_AS_TITLE'
				: 'TASK_VIEWS.DIALOG.CREATE_TITLE';
	}

	protected validName(): boolean {
		return normalizedViewName(this.name(), TASK_VIEW_NAME_MAX).length > 0;
	}

	protected validScope(): boolean {
		if (this.visibility() !== TaskViewVisibilityEnum.SHARED) return true;
		if (this.sharedScope() === 'team') return !!this.teamId();
		if (this.sharedScope() === 'project') return !!this.projectId();
		return true;
	}

	/** The placement the form describes. */
	placement(): TaskViewPlacement {
		const isShared = this.visibility() === TaskViewVisibilityEnum.SHARED;
		return {
			name: normalizedViewName(this.name(), TASK_VIEW_NAME_MAX),
			visibility: this.visibility(),
			organizationTeamId: isShared && this.sharedScope() === 'team' ? this.teamId() : null,
			projectId: isShared && this.sharedScope() === 'project' ? this.projectId() : null
		};
	}

	protected submit(): void {
		this.submitted.set(true);
		if (!this.validName() || !this.validScope()) return;
		this.ref.close(this.placement());
	}

	protected cancel(): void {
		this.ref.close(null);
	}
}
