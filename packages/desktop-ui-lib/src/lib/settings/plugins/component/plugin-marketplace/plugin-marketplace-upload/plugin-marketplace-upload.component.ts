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
import { TranslateService } from '@ngx-translate/core';
import { filter, Subject, take, tap } from 'rxjs';
import { PluginSourceActions } from '../+state/actions/plugin-source.action';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { ToastrNotificationService } from '../../../../../services';
import { SourceContext } from './plugin-source/creator/source.context';

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
		private readonly dialog: NbDialogService,
		private readonly action: Actions
	) {
		this.today = dateService.today();
	}

	ngOnInit(): void {
		this.initForm();
		this.patch();
	}

	private initForm(): void {
		this.pluginForm = new FormGroup({
			...(this.plugin && this.plugin.id && { id: new FormControl(this.plugin.id) }),
			name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
			description: new FormControl('', Validators.maxLength(500)),
			type: new FormControl(PluginType.DESKTOP, Validators.required),
			status: new FormControl(PluginStatus.ACTIVE, Validators.required),
			version: this.createVersionGroup(),
			author: new FormControl('', Validators.maxLength(100)),
			license: new FormControl('', Validators.maxLength(50)),
			homepage: new FormControl(
				'',
				Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
			),
			repository: new FormControl(
				'',
				Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
			)
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
		const hasSources = sources.length > 0;

		if (!hasSources) return;

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
		if (this.plugin) {
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
						this.action.dispatch(PluginSourceActions.delete(pluginId, versionId, id));
						this.sources.removeAt(idx);
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
	 */
	private pastDateValidator(): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			if (!control.value) return null;
			const inputDate = new Date(control.value);
			return inputDate > this.today ? { futureDate: true } : null;
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

		try {
			this.dialogRef.close(this.pluginForm.value);
		} catch (error) {
			this.toastrService.error(error.message || error);
		} finally {
			this.isSubmitting = false;
		}
	}

	public get sources(): FormArray {
		return this.pluginForm.get('version.sources') as FormArray;
	}

	private scrollToFirstInvalidControl(): void {
		const firstInvalidControl = document.querySelector('form .ng-invalid');
		if (firstInvalidControl) {
			firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
