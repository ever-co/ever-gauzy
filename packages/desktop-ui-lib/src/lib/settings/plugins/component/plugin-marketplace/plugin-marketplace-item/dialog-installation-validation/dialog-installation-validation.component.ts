import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ID, IPluginSource, PluginSourceType } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { filter, Observable, tap } from 'rxjs';
import { PluginSourceQuery } from '../../+state/queries/plugin-source.query';

@Component({
	selector: 'lib-dialog-installation-validation',
	templateUrl: './dialog-installation-validation.component.html',
	styleUrls: ['./dialog-installation-validation.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogInstallationValidationComponent implements OnInit {
	public form: FormGroup;
	public pluginId: ID;
	public versionId: ID;

	constructor(
		private readonly sourceQuery: PluginSourceQuery,
		private readonly dialogRef: NbDialogRef<DialogInstallationValidationComponent>
	) {}

	ngOnInit(): void {
		this.form = new FormGroup({
			source: new FormControl<IPluginSource>(null, [Validators.required])
		});
		this.source$
			.pipe(
				filter(Boolean),
				tap((source) => {
					this.form.removeControl('authToken');

					if (source.type === PluginSourceType.NPM) {
						this.form.addControl('authToken', new FormControl('', [Validators.required]));
					}
					this.form.get('source').setValue(source);
				})
			)
			.subscribe();
	}

	public get source$(): Observable<IPluginSource> {
		return this.sourceQuery.source$;
	}

	public dismiss(): void {
		this.dialogRef.close();
	}

	public submit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.dialogRef.close(this.form.value);
	}
}
