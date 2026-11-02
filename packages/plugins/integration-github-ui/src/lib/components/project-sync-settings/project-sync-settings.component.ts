import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import {
	NbAutocompleteModule,
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbInputModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, EMPTY, Observable, combineLatest, defer } from 'rxjs';
import { catchError, finalize, map, startWith, tap } from 'rxjs/operators';
import { SyncTags } from '@gauzy/constants';
import {
	GITHUB_LABEL_NAME_MAX_LENGTH,
	IGithubIssue,
	IIntegrationTenant,
	IOrganizationGithubRepository,
	IOrganizationProject,
	IOrganizationProjectSetting,
	isValidGithubLabelName,
	normalizeGithubLabelName,
	resolveGithubSyncLabel
} from '@gauzy/contracts';
import { ErrorHandlingService, GithubService, OrganizationProjectsService, ToastrService } from '@gauzy/ui-core/core';
import { collectGithubLabelNames, filterGithubLabelNames } from '../../github-project-sync';

/** How many of the repository's open issues are read for label suggestions: one page, the most GitHub serves. */
export const GITHUB_LABEL_SUGGESTION_ISSUES = 100;

/**
 * Refuses a label GitHub would not accept. An empty label is fine: the project then syncs on the default label.
 *
 * @param control - The sync label control.
 */
export function githubLabelNameValidator(control: AbstractControl): ValidationErrors | null {
	const name = normalizeGithubLabelName(control.value);
	return !name || isValidGithubLabelName(name) ? null : { githubLabelName: true };
}

/**
 * Edits how a project mapped to a GitHub repository syncs that repository's issues (#7083): auto-sync on or off,
 * every issue or only the labelled ones, and the label. The label picker offers the labels the repository's open
 * issues carry and accepts any other name; an empty one stands for the default label.
 *
 * Opened in a dialog by the GitHub integration page; it closes with the saved project setting, or nothing on cancel.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-github-project-sync-settings',
	imports: [
		AsyncPipe,
		ReactiveFormsModule,
		TranslatePipe,
		NbAutocompleteModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSpinnerModule,
		NbToggleModule
	],
	templateUrl: './project-sync-settings.component.html',
	styleUrls: ['./project-sync-settings.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class GithubProjectSyncSettingsComponent implements OnInit {
	/** The label a project syncs on when it has none of its own. */
	public readonly defaultSyncLabel: string = SyncTags.GAUZY;

	/** The longest label GitHub accepts. */
	public readonly labelMaxLength = GITHUB_LABEL_NAME_MAX_LENGTH;

	/** Whether the setting is being saved. */
	public saving = false;

	/** The label names to offer, filtered by what is typed in the label field. */
	public filteredLabels$: Observable<string[]>;

	/** Every label name to offer (see `collectGithubLabelNames`). */
	private readonly _labels$ = new BehaviorSubject<string[]>([]);

	/** The project mapped to the repository: a row of the GitHub page's synced projects. Set by the dialog context. */
	@Input() project: IOrganizationProject;

	/** The GitHub integration the repository is synced through. Set by the dialog context. */
	@Input() integration: IIntegrationTenant;

	public readonly form = new FormGroup({
		isTasksAutoSync: new FormControl(false, { nonNullable: true }),
		isTasksAutoSyncOnLabel: new FormControl(false, { nonNullable: true }),
		syncTag: new FormControl('', { nonNullable: true, validators: [githubLabelNameValidator] })
	});

	private readonly _dialogRef = inject<NbDialogRef<GithubProjectSyncSettingsComponent>>(NbDialogRef);
	private readonly _githubService = inject(GithubService);
	private readonly _organizationProjectsService = inject(OrganizationProjectsService);
	private readonly _toastrService = inject(ToastrService);
	private readonly _errorHandlingService = inject(ErrorHandlingService);

	/** The GitHub repository the project is mapped to. */
	get repository(): IOrganizationGithubRepository | undefined {
		return this.project?.customFields?.['repository'];
	}

	ngOnInit(): void {
		const { isTasksAutoSyncOnLabel, syncTag } = this.form.controls;

		this.form.setValue({
			isTasksAutoSync: !!this.project?.isTasksAutoSync,
			isTasksAutoSyncOnLabel: !!this.project?.isTasksAutoSyncOnLabel,
			syncTag: normalizeGithubLabelName(this.project?.syncTag)
		});

		// The label only applies to label-based sync: without it the field is hidden and does not block saving.
		this._toggleSyncLabel(isTasksAutoSyncOnLabel.value);
		isTasksAutoSyncOnLabel.valueChanges
			.pipe(
				tap((onLabel: boolean) => this._toggleSyncLabel(onLabel)),
				untilDestroyed(this)
			)
			.subscribe();

		// `defer`: each subscriber starts from the label as it is then, not as it was when the stream was built.
		const term$ = defer(() => syncTag.valueChanges.pipe(startWith(syncTag.value)));
		this.filteredLabels$ = combineLatest([this._labels$, term$]).pipe(
			map(([labels, term]) => filterGithubLabelNames(labels, term))
		);

		this._loadLabels();
	}

	/**
	 * Saves the project setting and closes the dialog with it.
	 */
	public save(): void {
		if (!this.project || this.form.invalid || this.saving) {
			return;
		}

		const { id: projectId, name } = this.project;
		this.saving = true;

		this._organizationProjectsService
			.updateProjectSetting(projectId, this.toProjectSetting())
			.pipe(
				tap((setting: IOrganizationProjectSetting) => {
					this._toastrService.success('INTEGRATIONS.GITHUB_PAGE.PROJECT_SYNC.SAVED', { project: name });
					this._dialogRef.close(setting);
				}),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				finalize(() => (this.saving = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Closes the dialog without saving.
	 */
	public cancel(): void {
		this._dialogRef.close();
	}

	/**
	 * The project setting the form stands for. The label goes with label-based sync only, as the label the project
	 * chose or the default one when the field is left empty; otherwise the project keeps the label it has.
	 */
	public toProjectSetting(): IOrganizationProjectSetting {
		const { isTasksAutoSync, isTasksAutoSyncOnLabel, syncTag } = this.form.getRawValue();
		const { organizationId, tenantId } = this.project;

		return {
			organizationId,
			tenantId,
			isTasksAutoSync,
			isTasksAutoSyncOnLabel,
			...(isTasksAutoSyncOnLabel ? { syncTag: resolveGithubSyncLabel(syncTag) } : {})
		};
	}

	/**
	 * Enables the label field for label-based sync, and disables it otherwise.
	 *
	 * @param onLabel - Whether the project syncs only labelled issues.
	 */
	private _toggleSyncLabel(onLabel: boolean): void {
		const { syncTag } = this.form.controls;
		if (onLabel) {
			syncTag.enable({ emitEvent: false });
		} else {
			syncTag.disable({ emitEvent: false });
		}
	}

	/**
	 * Offers the default label and the project's own at once, then the labels of the repository's open issues once
	 * they are read. They are suggestions only: when the repository cannot be read, any label can still be typed.
	 */
	private _loadLabels(): void {
		const preferred = [this.defaultSyncLabel, this.project?.syncTag];
		this._labels$.next(collectGithubLabelNames([], preferred));

		const repository = this.repository;
		if (!this.integration?.id || !this.project || !repository?.owner || !repository?.name) {
			return;
		}

		const { organizationId, tenantId } = this.project;
		this._githubService
			.getRepositoryIssues(this.integration.id, repository.owner, repository.name, {
				organizationId,
				tenantId,
				page: 1,
				per_page: GITHUB_LABEL_SUGGESTION_ISSUES
			})
			.pipe(
				map((issues: IGithubIssue[]) => collectGithubLabelNames(issues, preferred)),
				tap((labels: string[]) => this._labels$.next(labels)),
				catchError(() => EMPTY),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
