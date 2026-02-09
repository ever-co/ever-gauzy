import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IPlugin, IPluginSource, IPluginVersion, PluginSourceType } from '@gauzy/contracts';
import { NbDialogRef, NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs';
import { PluginVersionQuery } from '../../+state/queries/plugin-version.query';
import { SourceContext } from '../../plugin-marketplace-upload/plugin-source/creator/source.context';
import { FormRowComponent } from '../../plugin-marketplace-upload/form-row/form-row.component';
import { VersionSelectorComponent } from '../version-selector/version-selector.component';
import { SourceContainerComponent } from '../../../../shared/ui/source-container/source-container.component';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Component for creating a new plugin source through a dialog
 */

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'lib-dialog-create-source',
    templateUrl: './dialog-create-source.component.html',
    styleUrl: './dialog-create-source.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ReactiveFormsModule, NbCardModule, NbIconModule, NbButtonModule, FormRowComponent, VersionSelectorComponent, SourceContainerComponent, TranslatePipe]
})
export class DialogCreateSourceComponent implements OnInit {
	/** The plugin for which the source is being created */
	public readonly plugin: IPlugin;
	/** Available source types for the plugin */
	public readonly sourceTypes = Object.values(PluginSourceType);
	/** The version of the plugin for which the source is being created */
	public version: IPluginVersion;
	/** Form group for managing the source creation */
	public form: FormGroup;

	constructor(
		private readonly dialogRef: NbDialogRef<DialogCreateSourceComponent>,
		private readonly versionQuery: PluginVersionQuery,
		private readonly sourceContext: SourceContext
	) {}

	/**
	 * Initializes the component and sets up the form
	 */
	ngOnInit(): void {
		this.initializeForm();
		this.setupVersionListener();
	}

	private setupVersionListener() {
		this.versionQuery.version$
			.pipe(
				tap((version) => {
					if (!version) return;
					this.version = version;
					this.form?.patchValue({ versionId: version.id });
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initializes the form with default values and validators
	 */
	private initializeForm(): void {
		this.form = new FormGroup({
			pluginId: new FormControl(this.plugin?.id || null, Validators.required),
			versionId: new FormControl(this.version?.id || null, Validators.required),
			sources: new FormArray([this.sourceContext.getCreator(PluginSourceType.CDN).createSource()])
		});
	}

	public addSource(type: PluginSourceType = PluginSourceType.CDN, data?: IPluginSource): void {
		const source = this.sourceContext.getCreator(type).createSource(data);
		this.sources.push(source);
	}

	public removeSource(index: number): void {
		this.sources.removeAt(index);
	}

	public get sources(): FormArray {
		return this.form.get('sources') as FormArray;
	}

	/**
	 * Closes the dialog without submitting
	 */
	public dismiss(): void {
		this.dialogRef.close();
	}

	/**
	 * Submits the form if valid
	 */
	public submit(): void {
		if (this.form.invalid) {
			this.markFormGroupTouched(this.form);
			return;
		}
		this.dialogRef.close(this.form.value);
	}

	/**
	 * Marks all controls in a form group as touched
	 * @param formGroup The form group to mark as touched
	 */
	private markFormGroupTouched(formGroup: FormGroup): void {
		Object.values(formGroup.controls).forEach((control) => {
			control.markAsTouched();
			if (control instanceof FormGroup) {
				this.markFormGroupTouched(control);
			}
		});
	}
}
