import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { IPipeline, IContact } from '@gauzy/contracts';
import { PipelinesService } from '../../../../@core/services/pipelines.service';
import { DealsService } from '../../../../@core/services/deals.service';
import { AppStore, Store } from '../../../../@core/services/store.service';
import { OrganizationContactService } from '../../../../@core/services/organization-contact.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './pipeline-deal-form.component.html',
	selector: 'ga-pipeline-deals-form',
	styleUrls: ['./pipeline-deal-form.component.scss']
})
export class PipelineDealFormComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	form: UntypedFormGroup;
	pipeline: IPipeline;
	clients: IContact[];
	selectedClient: IContact;
	probabilities = [0, 1, 2, 3, 4, 5];
	selectedProbability: number;
	mode: 'CREATE' | 'EDIT' = 'CREATE';
	dealId: string;
	pipelineId: string;

	private readonly $akitaPreUpdate: AppStore['akitaPreUpdate'];
	private _ngDestroy$ = new Subject<void>();
	private organizationId: string;
	private tenantId: string;

	constructor(
		public translateService: TranslateService,
		private router: Router,
		private fb: UntypedFormBuilder,
		private appStore: AppStore,
		private store: Store,
		private dealsService: DealsService,
		private activatedRoute: ActivatedRoute,
		private pipelinesService: PipelinesService,
		private clientsService: OrganizationContactService,
		private toastrService: ToastrService
	) {
		super(translateService);

		this.$akitaPreUpdate = appStore.akitaPreUpdate;

		appStore.akitaPreUpdate = (previous, next) => {
			if (previous.user !== next.user) {
				setTimeout(() => this.form.patchValue({ createdByUserId: next.user.id }));
			}

			return this.$akitaPreUpdate(previous, next);
		};
	}

	ngOnInit() {
		this._initializeForm();
		this.activatedRoute.params
			.pipe(
				filter((params) => !!params),
				untilDestroyed(this)
			)
			.subscribe(async ({ pipelineId, dealId }) => {
				this.form.disable();
				if (pipelineId) {
					this.pipelineId = pipelineId;
					this.mode = 'EDIT';
				}
				if (dealId) {
					this.dealId = dealId;
				}
				this.form.enable();
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (org) => {
				this.organizationId = org.id;
				this.tenantId = this.store.user.tenantId;

				await this.getOrganizationContact();

				if (this.pipelineId) {
					await this.getPipelines();
				}
				if (this.dealId) {
					await this.getDeal();
				}
			});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			createdByUserId: [null, Validators.required],
			stageId: [null, Validators.required],
			title: [null, Validators.required],
			clientId: [null],
			probability: [null, Validators.required]
		});
		this.form.patchValue({
			createdByUserId: this.appStore.getValue().user?.id
		});
	}

	async getPipelines() {
		const { tenantId } = this;
		await this.pipelinesService
			.getAll(['stages'], {
				id: this.pipelineId,
				tenantId
			})
			.then(({ items: [value] }) => (this.pipeline = value));

		this.form.patchValue({ stageId: this.pipeline.stages[0]?.id });
	}

	async getDeal() {
		const { tenantId } = this;
		await this.dealsService
			.getOne(this.dealId, { tenantId }, ['client'])
			.then(({ title, stageId, createdBy, probability, clientId, client }) => {
				this.form.patchValue({
					title,
					stageId,
					createdBy,
					probability,
					clientId
				});
				this.selectedProbability = probability;
			});
	}

	async getOrganizationContact() {
		await this.clientsService
			.getAll([], {
				organizationId: this.organizationId,
				tenantId: this.tenantId
			})
			.then((res) => (this.clients = res.items));
	}

	public async onSubmit(): Promise<void> {
		const {
			dealId,
			activatedRoute: relativeTo,
			form: { value }
		} = this;

		this.form.disable();
		await (this.dealId
			? this.dealsService.update(
					this.dealId,
					Object.assign(
						{
							organizationId: this.organizationId,
							tenantId: this.tenantId
						},
						value
					)
			  )
			: this.dealsService.create(
					Object.assign(
						{
							organizationId: this.organizationId,
							tenantId: this.tenantId
						},
						value
					)
			  )
		)
			.then(() => {
				if (this.dealId) {
					this.toastrService.success('PIPELINE_DEALS_PAGE.DEAL_EDITED', {
						name: value.title
					});
				} else {
					this.toastrService.success('PIPELINE_DEALS_PAGE.DEAL_ADDED', {
						name: value.title
					});
				}
				this.router.navigate([dealId ? '../..' : '..'], { relativeTo });
			})
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
