import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ID, IPluginSource, IPluginVersion } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, filter, map, Observable, tap } from 'rxjs';
import { PluginSourceQuery } from '../../+state/queries/plugin-source.query';
import { PluginVersionQuery } from '../../+state/queries/plugin-version.query';

@UntilDestroy({ checkProperties: true })
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

	constructor(
		private readonly sourceQuery: PluginSourceQuery,
		private readonly versionQuery: PluginVersionQuery,
		private readonly dialogRef: NbDialogRef<DialogInstallationValidationComponent>
	) {}

	ngOnInit(): void {
		this.form = new FormGroup({
			source: new FormControl<IPluginSource>(null, [Validators.required]),
			version: new FormControl<IPluginVersion>(null, [Validators.required]),
			authToken: new FormControl(null, Validators.required)
		});

		combineLatest([this.source$, this.version$])
			.pipe(
				filter(Boolean),
				tap(([source, version]) => {
					this.form.patchValue({
						source,
						version
					});

					if (source?.private) {
						this.form.controls['authToken'].enable();
					} else {
						this.form.controls['authToken'].disable();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get source$(): Observable<IPluginSource> {
		return this.sourceQuery.source$;
	}

	public get version$(): Observable<IPluginVersion> {
		return this.versionQuery.version$;
	}

	public get versionId$(): Observable<ID> {
		return this.version$.pipe(map((version) => version.id));
	}

	public dismiss(): void {
		this.dialogRef.close();
	}

	public get showAuthToken(): boolean {
		return this.form?.get('source')?.value?.private || false;
	}

	public submit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.dialogRef.close(this.form.value);
	}
}
