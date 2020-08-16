import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Pipeline, Contact } from '@gauzy/models';
import { PipelinesService } from '../../../../@core/services/pipelines.service';
import { DealsService } from '../../../../@core/services/deals.service';
import { AppStore, Store } from '../../../../@core/services/store.service';
import { OrganizationContactService } from 'apps/gauzy/src/app/@core/services/organization-contact.service';

@Component({
	templateUrl: './pipeline-deal-form.component.html',
	selector: 'ga-pipeline-deals-form',
	styleUrls: ['./pipeline-deal-form.component.scss']
})
export class PipelineDealFormComponent implements OnInit, OnDestroy {
	form: FormGroup;
	pipeline: Pipeline;
	clients: Contact[];
	selectedClient: Contact;
	probabilities = [0, 1, 2, 3, 4, 5];
	selectedProbability: number;
	mode: 'CREATE' | 'EDIT' = 'CREATE';
	id: string;

	private readonly $akitaPreUpdate: AppStore['akitaPreUpdate'];
	private _ngDestroy$ = new Subject<void>();
	private _selectedOrganizationId: string;

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private appStore: AppStore,
		private store: Store,
		private dealsService: DealsService,
		private activatedRoute: ActivatedRoute,
		private pipelinesService: PipelinesService,
		private clientsService: OrganizationContactService
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

	ngOnInit() {
		this.form = this.fb.group({
			createdByUserId: [null, Validators.required],
			stageId: [null, Validators.required],
			title: [null, Validators.required],
			clientId: [null],
			probability: [null]
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
					.then(({ title, stageId, createdBy, probability }) => {
						this.form.patchValue({ title, stageId, createdBy });
						this.selectedProbability = probability;
					});
			}

			this.form.enable();
		});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				this._selectedOrganizationId = org.id;
			});

		this.clientsService
			.getAll([], { organizationId: this._selectedOrganizationId })
			.then((res) => (this.clients = res.items));
	}

	public async onSubmit(): Promise<void> {
		const {
			id,
			activatedRoute: relativeTo,
			form: { value }
		} = this;

		this.form.disable();
		await (this.id
			? this.dealsService.update(
					this.id,
					Object.assign(
						{ organizationId: this._selectedOrganizationId },
						value
					)
			  )
			: this.dealsService.create(
					Object.assign(
						{ organizationId: this._selectedOrganizationId },
						value
					)
			  )
		)
			.then(() =>
				this.router.navigate([id ? '../..' : '..'], { relativeTo })
			)
			.catch(() => this.form.enable());
	}

	cancel() {
		window.history.back();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
