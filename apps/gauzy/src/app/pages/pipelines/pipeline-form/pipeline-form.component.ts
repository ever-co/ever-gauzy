import { Component, Input, OnInit } from '@angular/core';
import { PipelineCreateInput, UserOrganization } from '@gauzy/models';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { Store } from '../../../@core/services/store.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import { NbDialogRef } from '@nebular/theme';

@Component({
	templateUrl: './pipeline-form.component.html',
	selector: 'ga-pipeline-form',
	styles: ['./pipeline-form.component.scss']
})
export class PipelineFormComponent implements OnInit {
	@Input()
	pipeline: PipelineCreateInput & { id?: string };

	userOrganizations: UserOrganization[];
	form: FormGroup;
	icon: string;

	constructor(
		public dialogRef: NbDialogRef<PipelineFormComponent['pipeline']>,
		private usersOrganizationsService: UsersOrganizationsService,
		private pipelinesService: PipelinesService,
		private fb: FormBuilder,
		private store: Store
	) {}

	ngOnInit(): void {
		const { id } = this.pipeline;
		const { userId } = this.store;

		this.usersOrganizationsService
			.getAll(['organization'], { userId })
			.then(({ items }) => (this.userOrganizations = items));
		this.form = this.fb.group({
			organizationId: [
				this.pipeline.organizationId || '',
				Validators.required
			],
			name: [this.pipeline.name || '', Validators.required],
			...(id ? { id: [id, Validators.required] } : {}),
			description: [this.pipeline.description],
			stages: this.fb.array([])
		});
	}

	persist(): void {
		const {
			value,
			value: { id }
		} = this.form;

		Promise.race([
			id
				? this.pipelinesService.update(id, value)
				: this.pipelinesService.create(value)
		]).then((entity) => this.dialogRef.close(entity));
	}
}
