import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, IPipeline } from '@gauzy/contracts';
import { ErrorHandlingService, PipelinesService, Store } from '@gauzy/ui-core/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';

@UntilDestroy({ checkProperties: true })
@Component({
    templateUrl: './pipeline-form.component.html',
    styleUrls: ['./pipeline-form.component.scss'],
    selector: 'ga-pipeline-mutation-form',
    standalone: false
})
export class PipelineFormComponent implements OnInit {
	public isActive: boolean = true;
	public organization: IOrganization;

	/**
	 * Form property setter and getter.
	 */
	public form: UntypedFormGroup = this._fb.group({
		name: ['', Validators.required],
		description: [''],
		stages: this._fb.array([]),
		isActive: [this.isActive]
	});

	/**
	 * Pipeline property setter and getter.
	 * @param value
	 */
	private _pipeline: IPipeline;
	@Input() set pipeline(value: IPipeline) {
		this._pipeline = value;
		this.onPipelineChange(value);
	}
	get pipeline(): IPipeline {
		return this._pipeline;
	}

	constructor(
		private readonly _dialogRef: NbDialogRef<PipelineFormComponent['pipeline']>,
		private readonly _pipelinesService: PipelinesService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles changes to the pipeline input.
	 * @param value The new pipeline value
	 */
	private onPipelineChange(pipeline: IPipeline): void {
		this.isActive = pipeline.isActive ?? true;

		// Patch form values with the new pipeline data
		this.form.patchValue({
			name: pipeline.name,
			description: pipeline.description,
			isActive: this.isActive,
			stages: pipeline.stages
		});
	}

	/**
	 * Closes the dialog.
	 */
	closeDialog() {
		this._dialogRef.close();
	}

	/**
	 * Toggles the isActive property between true and false.
	 */
	setIsActive() {
		this.isActive = !this.isActive;
	}

	/**
	 * Persists the form data by either creating a new entity or updating an existing one.
	 * This method handles the dialog closure and error logging as well.
	 */
	async persist(): Promise<void> {
		if (!this.organization) {
			return;
		}

		// Destructure the organization details and form value
		const { id: organizationId, tenantId } = this.organization;
		const value = { ...this.form.value, organizationId, tenantId, isArchived: !this.isActive };

		try {
			// Determine whether to create or update based on the presence of an ID
			const entity = this.pipeline?.id
				? await this._pipelinesService.update(this.pipeline.id, value)
				: await this._pipelinesService.create(value);

			// Close the dialog with the returned entity
			this._dialogRef.close(entity);
		} catch (error) {
			// Handle and log any error that occurs during the persistence process
			console.error(`Error occurred while persisting data: ${error.message}`);
			this._errorHandlingService.handleError(error);
		}
	}
}
