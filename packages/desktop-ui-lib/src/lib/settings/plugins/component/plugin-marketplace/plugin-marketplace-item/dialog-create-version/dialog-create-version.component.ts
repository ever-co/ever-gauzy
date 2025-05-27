import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import {
	AbstractControl,
	FormArray,
	FormControl,
	FormGroup,
	ValidationErrors,
	ValidatorFn,
	Validators
} from '@angular/forms';
import { IPlugin, IPluginSource, IPluginVersion, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { NbDateService, NbDialogRef, NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, Subject, take, tap } from 'rxjs';
import { PluginSourceActions } from '../../+state/actions/plugin-source.action';
import { PluginVersionQuery } from '../../+state/queries/plugin-version.query';
import { AlertComponent } from '../../../../../../dialogs/alert/alert.component';
import { ToastrNotificationService } from '../../../../../../services';
import { SourceContext } from '../../plugin-marketplace-upload/plugin-source/creator/source.context';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-dialog-create-version',
	templateUrl: './dialog-create-version.component.html',
	styleUrls: ['./dialog-create-version.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogCreateVersionComponent implements OnInit, OnDestroy {
	versionForm: FormGroup;
	plugin: IPlugin;
	version: IPluginVersion;
	pluginTypes = Object.values(PluginType);
	pluginStatuses = Object.values(PluginStatus);
	sourceTypes = Object.values(PluginSourceType);
	isSubmitting = false;
	formTouched = false;
	today: Date;
	destroy$ = new Subject<void>();
	selectedSourceType: PluginSourceType = PluginSourceType.CDN;
	showSourceSelector = false;
	private readonly sourceIcons = new Map<PluginSourceType, string>([
		[PluginSourceType.CDN, 'layers-outline'],
		[PluginSourceType.GAUZY, 'cube-outline'],
		[PluginSourceType.NPM, 'code-outline']
	]);

	constructor(
		private readonly dialogRef: NbDialogRef<DialogCreateVersionComponent>,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		protected readonly dateService: NbDateService<Date>,
		private readonly sourceContext: SourceContext,
		private readonly action: Actions,
		private readonly dialog: NbDialogService,
		private readonly versionQuery: PluginVersionQuery
	) {
		this.today = dateService.today();
	}

	ngOnInit(): void {
		this.initForm();
		this.setupVersionListener();
	}

	private setupVersionListener() {
		this.versionQuery.version$
			.pipe(
				tap((version) => {
					this.version = this.version ? version : null;
					this.patch();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initForm(): void {
		this.versionForm = this.createVersionGroup();
	}

	private createVersionGroup(): FormGroup {
		return new FormGroup({
			...(this.version?.id && { id: new FormControl(this.version.id) }),
			number: new FormControl('', [
				Validators.required,
				Validators.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
			]),
			changelog: new FormControl('', [Validators.required, Validators.minLength(10)]),
			releaseDate: new FormControl(this.today, [Validators.required, this.pastDateValidator()]),
			sources: new FormArray([this.sourceContext.getCreator(PluginSourceType.CDN).createSource()])
		});
	}

	private patch(): void {
		if (!this.version) return;

		const version: Partial<IPluginVersion> = {
			...this.version
		}; //create a copy of the version

		const sources = version.sources ?? [];
		const hasSources = sources.length > 0;

		if (!hasSources) return;

		const sourcesArray = this.versionForm.get('sources') as FormArray;
		sourcesArray.clear();

		for (const source of sources) {
			this.addSource(source.type, source);
		}

		this.versionForm.patchValue(version);
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

	public addSource(type: PluginSourceType = this.selectedSourceType, data?: IPluginSource): void {
		const source = this.sourceContext.getCreator(type).createSource(data);
		this.sources.push(source);
	}

	public removeSource(idx: number): void {
		if (this.version) {
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
						this.sources.removeAt(idx);
						this.action.dispatch(PluginSourceActions.delete(this.plugin.id, this.version.id, id));
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

	public reset(): void {
		this.initForm();
		this.formTouched = false;
	}

	public submit(): void {
		this.formTouched = true;

		if (this.versionForm.invalid) {
			this.markFormGroupTouched(this.versionForm);
			this.scrollToFirstInvalidControl();
			this.toastrService.error(this.translateService.instant('PLUGIN.FORM.VALIDATION.FAILED'));
			return;
		}

		this.isSubmitting = true;

		try {
			const data = this.versionForm.value;
			this.dialogRef.close(data);
		} catch (error) {
			this.toastrService.error(error.message || error);
		} finally {
			this.isSubmitting = false;
		}
	}

	public get sources(): FormArray {
		return this.versionForm.get('sources') as FormArray;
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
		return this.versionForm.invalid;
	}

	public get versionNumber(): string {
		return this.versionForm?.get('number')?.value;
	}

	public drop(event: CdkDragDrop<string[]>) {
		moveItemInArray(this.sources.controls, event.previousIndex, event.currentIndex);
	}

	public openSourceTypeSelector() {
		this.showSourceSelector = true;
	}

	public closeSourceTypeSelector() {
		this.showSourceSelector = false;
	}

	public getSourceIcon(sourceType: PluginSourceType): string {
		return this.sourceIcons.get(sourceType);
	}
	ngOnDestroy(): void {
		this.reset();
		this.destroy$.next();
		this.destroy$.complete();
	}
}
