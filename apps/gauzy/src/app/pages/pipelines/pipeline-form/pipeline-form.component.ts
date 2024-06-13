import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { IOrganization, IPipeline, IPipelineCreateInput } from '@gauzy/contracts';
import { PipelinesService } from '@gauzy/ui-core/core';

@Component({
	templateUrl: './pipeline-form.component.html',
	styleUrls: ['./pipeline-form.component.scss'],
	selector: 'ga-pipeline-form'
})
export class PipelineFormComponent implements OnInit {
	@Input() pipeline: IPipelineCreateInput & { id?: string };

	form: UntypedFormGroup;
	icon: string;
	isActive: boolean;
	organization: IOrganization;

	constructor(
		public readonly dialogRef: NbDialogRef<PipelineFormComponent['pipeline']>,
		private readonly pipelinesService: PipelinesService,
		private readonly fb: UntypedFormBuilder
	) {}

	ngOnInit(): void {
		const { id, isActive } = this.pipeline;
		isActive === undefined ? (this.isActive = true) : (this.isActive = isActive);

		this.form = this.fb.group({
			organizationId: [this.pipeline.organizationId || '', Validators.required],
			tenantId: [this.pipeline.tenantId || ''],
			name: [this.pipeline.name || '', Validators.required],
			...(id ? { id: [id, Validators.required] } : {}),
			description: [this.pipeline.description],
			stages: this.fb.array([]),
			isActive: [this.isActive]
		});
	}

	/**
	 *
	 */
	setIsActive() {
		this.isActive = !this.isActive;
	}

	/**
	 *
	 */
	async persist(): Promise<void> {
		try {
			const {
				value,
				value: { id }
			} = this.form;
			let entity: IPipeline;

			// Determine whether to create or update based on the presence of an ID
			if (id) {
				entity = await this.pipelinesService.update(id, value);
			} else {
				entity = await this.pipelinesService.create(value);
			}

			// Close the dialog with the returned entity
			this.dialogRef.close(entity);
		} catch (error) {
			console.error(`Error occurred while persisting data: ${error.message}`);
		}
	}
}
