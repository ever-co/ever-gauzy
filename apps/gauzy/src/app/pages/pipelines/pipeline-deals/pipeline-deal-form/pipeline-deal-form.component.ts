import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Pipeline } from '@gauzy/models';
import { PipelinesService } from '../../../../@core/services/pipelines.service';
import { DealsService } from '../../../../@core/services/deals.service';
import { AppStore } from '../../../../@core/services/store.service';

@Component({
	templateUrl: './pipeline-deal-form.component.html',
	selector: 'ga-pipeline-deals-form'
})
export class PipelineDealFormComponent implements OnInit {
	public id: string;

	public form: FormGroup;

	public pipeline: Pipeline;

	public mode: 'CREATE' | 'EDIT' = 'CREATE';

	private readonly $akitaPreUpdate: AppStore['akitaPreUpdate'];

	public constructor(
		private router: Router,
		private fb: FormBuilder,
		private appStore: AppStore,
		private dealsService: DealsService,
		private activatedRoute: ActivatedRoute,
		private pipelinesService: PipelinesService
	) {
		this.$akitaPreUpdate = appStore.akitaPreUpdate;
		appStore.akitaPreUpdate = (previous, next) => {
			if (previous.user !== next.user) {
				setTimeout(() =>
					this.form.patchValue({ createdByUserId: next.user.id })
				);
			}

			return this.$akitaPreUpdate(previous, next);
		};
	}

	public ngOnInit(): void {
		this.form = this.fb.group({
			createdByUserId: [null, Validators.required],
			stageId: [null, Validators.required],
			title: [null, Validators.required]
		});
		this.form.patchValue({
			createdByUserId: this.appStore.getValue().user?.id
		});
		this.activatedRoute.params.subscribe(async ({ pipelineId, dealId }) => {
			this.form.disable();

			if (pipelineId) {
				this.mode = 'EDIT';
				await this.pipelinesService
					.find(['stages'], {
						id: pipelineId
					})
					.then(({ items: [value] }) => (this.pipeline = value));
				this.form.patchValue({ stageId: this.pipeline.stages[0]?.id });
			}

			if (dealId) {
				this.id = dealId;
				await this.dealsService
					.find(dealId)
					.then(({ title, stageId, createdBy }) => {
						this.form.patchValue({ title, stageId, createdBy });
					});
			}

			this.form.enable();
		});
	}

	public async onSubmit(): Promise<void> {
		const {
			id,
			activatedRoute: relativeTo,
			form: { value }
		} = this;

		this.form.disable();
		await (this.id
			? this.dealsService.update(this.id, value)
			: this.dealsService.create(value)
		)
			.then(() =>
				this.router.navigate([id ? '../..' : '..'], { relativeTo })
			)
			.catch(() => this.form.enable());
	}

	cancel() {
		window.history.back();
	}
}
