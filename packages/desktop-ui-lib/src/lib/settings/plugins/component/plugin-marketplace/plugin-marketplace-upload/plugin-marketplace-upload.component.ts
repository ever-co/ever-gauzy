import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	AbstractControl,
	FormArray,
	FormControl,
	FormGroup,
	ValidationErrors,
	ValidatorFn,
	Validators
} from '@angular/forms';
import { IPlugin, IPluginSource, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { NbDateService, NbDialogRef, NbDialogService, NbStepperComponent } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, Subject, take, tap } from 'rxjs';
import { PluginSourceActions } from '../+state/actions/plugin-source.action';
import { PluginVersionQuery } from '../+state/queries/plugin-version.query';
import { patterns } from '../../../../../constants';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { ToastrNotificationService } from '../../../../../services';
import { SourceContext } from './plugin-source/creator/source.context';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace-upload',
	templateUrl: './plugin-marketplace-upload.component.html',
	styleUrls: ['./plugin-marketplace-upload.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceUploadComponent implements OnInit, OnDestroy {
	@ViewChild('stepper', { static: false }) stepper: NbStepperComponent;

	pluginForm: FormGroup;
	plugin: IPlugin;
	pluginTypes = Object.values(PluginType);
	pluginStatuses = Object.values(PluginStatus);
	sourceTypes = Object.values(PluginSourceType);
	isSubmitting = false;
	formTouched = false;
	today: Date; // Ensures a proper date comparison
	destroy$ = new Subject<void>();
	selectedSourceType: PluginSourceType = PluginSourceType.CDN;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginMarketplaceUploadComponent>,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		protected readonly dateService: NbDateService<Date>,
		private readonly sourceContext: SourceContext,
		private readonly versionQuery: PluginVersionQuery,
		private readonly dialog: NbDialogService,
		private readonly action: Actions
	) {
		this.today = dateService.today();
	}

	ngOnInit(): void {
		this.initForm();
		this.setupVersionListeners();
	}

	private setupVersionListeners() {
		this.versionQuery.version$
			.pipe(
				filter(() => Boolean(this.plugin)),
				tap((version) => {
					this.plugin = {
						...this.plugin,
						version: this.plugin?.version ? version : null
					};
					this.patch();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initForm(): void {
		this.pluginForm = new FormGroup({
			...(this.plugin?.id && { id: new FormControl(this.plugin.id) }),
			name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
			description: new FormControl('', Validators.maxLength(500)),
			type: new FormControl(PluginType.DESKTOP, Validators.required),
			status: new FormControl(PluginStatus.ACTIVE, Validators.required),
			version: this.createVersionGroup(),
			author: new FormControl('', Validators.maxLength(100)),
			license: new FormControl('', Validators.maxLength(50)),
			homepage: new FormControl('', Validators.pattern(patterns.websiteUrl)),
			repository: new FormControl('', Validators.pattern(patterns.websiteUrl))
		});
	}

	private patch(): void {
		if (!this.plugin) return;

		const { name, description, type, status, version, author, license, homepage, repository } = this.plugin;

		const data: Partial<IPlugin> = {
			name,
			description,
			type,
			status,
			author,
			license,
			homepage,
			repository
		};

		if (!version) return;

		data.version = { ...version };

		const sources = version.sources ?? [];
		const versionGroup = this.pluginForm.get('version') as FormGroup;
		const sourcesArray = versionGroup.get('sources') as FormArray;
		sourcesArray.clear();

		for (const source of sources) {
			this.addSource(source.type, source);
		}

		this.pluginForm.patchValue(data);
	}

	public addSource(type: PluginSourceType = this.selectedSourceType, data?: IPluginSource): void {
		const source = this.sourceContext.getCreator(type).createSource(data);
		this.sources.push(source);
	}

	public removeSource(idx: number): void {
		if (this.plugin && this.plugin.version) {
			this.dialog
				.open(AlertComponent, {
					context: {
						data: {
							message: 'Delete this source?',
							title: 'Delete Source',
							confirmText: 'Delete',
							status: 'basic'
						}
					}
				})
				.onClose.pipe(
					take(1),
					filter(Boolean),
					tap(() => {
						const { id } = this.sources.at(idx).value as IPluginSource;
						const {
							id: pluginId,
							version: { id: versionId }
						} = this.plugin;
						this.sources.removeAt(idx);
						this.action.dispatch(PluginSourceActions.delete(pluginId, versionId, id));
					})
				)
				.subscribe();
		} else {
			this.sources.removeAt(idx);
		}
	}

	public restoreSource(idx: number): void {
		this.dialog
			.open(AlertComponent, {
				context: {
					data: {
						message: 'Restore this source?',
						title: 'Restore Source',
						confirmText: 'Restore',
						status: 'basic'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => {
					const { id, versionId } = this.sources.at(idx).value as IPluginSource;
					this.action.dispatch(PluginSourceActions.restore(this.plugin.id, versionId, id));
				})
			)
			.subscribe();
	}

	private createVersionGroup(): FormGroup {
		return new FormGroup({
			...(this.plugin?.version?.id && { id: new FormControl(this.plugin.version.id) }),
			number: new FormControl('', [
				Validators.required,
				Validators.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
			]),
			changelog: new FormControl('', [Validators.required, Validators.minLength(10)]),
			releaseDate: new FormControl(this.today, [Validators.required, this.pastDateValidator()]),
			sources: new FormArray([this.sourceContext.getCreator(PluginSourceType.CDN).createSource()])
		});
	}

	/**
	 * Custom validator to ensure the release date is not in the future.
	 * Note: today is recalculated each time for accuracy.
	 */
	private pastDateValidator(): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			if (!control.value) return null;
			const inputDate = new Date(control.value);
			const today = this.dateService.today();
			return inputDate > today ? { futureDate: true } : null;
		};
	}

	public reset(): void {
		this.initForm();
		this.formTouched = false;
	}

	public submit(): void {
		this.formTouched = true;

		if (this.pluginForm.invalid) {
			this.markFormGroupTouched(this.pluginForm);
			this.scrollToFirstInvalidControl();
			this.toastrService.error(this.translateService.instant('PLUGIN.FORM.VALIDATION.FAILED'));
			return;
		}

		this.isSubmitting = true;

		this.dialogRef.close(this.pluginForm.value);
		this.isSubmitting = false;
	}

	public get sources(): FormArray {
		if (!this.pluginForm) return new FormArray([]);
		const versionGroup = this.pluginForm.get('version');
		if (!versionGroup) return new FormArray([]);
		const sourcesArray = (versionGroup as FormGroup).get('sources');
		if (!sourcesArray) return new FormArray([]);
		return sourcesArray as FormArray;
	}

	private scrollToFirstInvalidControl(): void {
		const firstInvalidControl = document.querySelector('form .ng-invalid') as HTMLElement;
		if (firstInvalidControl) {
			firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			firstInvalidControl.focus?.();
		}
	}

	private markFormGroupTouched(formGroup: FormGroup): void {
		Object.values(formGroup.controls).forEach((control) => {
			control.markAsTouched();
			control.markAsDirty();

			if (control instanceof FormGroup) {
				this.markFormGroupTouched(control);
			}
		});
	}

	public dismiss(): void {
		this.dialogRef.close();
	}

	public get isFormInvalid(): boolean {
		return this.pluginForm.invalid;
	}

	ngOnDestroy(): void {
		this.reset();
		this.destroy$.next();
		this.destroy$.complete();
	}
}
