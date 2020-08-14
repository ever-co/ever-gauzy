import { Component, OnInit, OnDestroy } from '@angular/core';
import { Deal, Pipeline, ComponentLayoutStyleEnum } from '@gauzy/models';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import { ActivatedRoute, Router, RouterEvent, NavigationEnd } from '@angular/router';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DealsService } from '../../../@core/services/deals.service';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { PipelineDealCreatedByComponent } from '../table-components/pipeline-deal-created-by/pipeline-deal-created-by';
import { PipelineDealExcerptComponent } from '../table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from '../table-components/pipeline-deal-probability/pipeline-deal-probability.component';

@Component({
	selector: 'ga-pipeline-deals',
	templateUrl: './pipeline-deals.component.html',
	styleUrls: ['./pipeline-deals.component.scss']
})
export class PipelineDealsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	deals = new LocalDataSource([] as Deal[]);
	dealsData: Deal[];
	filteredDeals: Deal[];
	pipeline: Pipeline;
	stageId: string;
	deal: Deal;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	private _selectedOrganizationId: string;
	private _ngDestroy$ = new Subject<void>();

	readonly smartTableSettings = {
		actions: false,
		noDataMessage: '-',
		columns: {
			title: {
				type: 'string',
				title: 'title'
			},
			stage: {
				filter: false,
				editor: false,
				title: 'Stage',
				type: 'custom',
				renderComponent: PipelineDealExcerptComponent
			},
			createdBy: {
				title: 'Created by',
				type: 'custom',
				renderComponent: PipelineDealCreatedByComponent
			},
			probability: {
				title: 'Probability',
				type: 'custom',
				width: '15%',
				class: 'text-center',
				renderComponent: PipelineDealProbabilityComponent
			}
		}
	};

	constructor(
		public translateService: TranslateService,
		private dealsService: DealsService,
		private dialogService: NbDialogService,
		private activatedRoute: ActivatedRoute,
		private pipelinesService: PipelinesService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.updateViewData();

		this.smartTableSettings.noDataMessage = this.getTranslation('SM_TABLE.NO_RESULT');
		this.smartTableSettings.columns.title.title = this.getTranslation('SM_TABLE.TITLE');
		this.smartTableSettings.columns.stage.title = this.getTranslation('SM_TABLE.STAGE');
		this.smartTableSettings.columns.createdBy.title = this.getTranslation('Created by');

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.PIPELINE_DEALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	filterDealsByStage(): void {
		const { stageId: search = '' } = this;

		this.deals.setFilter([
			{ field: 'stageId', search }
		]);

		if (this.stageId) {
			this.filteredDeals = this.dealsData.filter(deal => deal.stageId === this.stageId);
		} else {
			this.filteredDeals = this.dealsData;
		}
	}

	async deleteDeal(): Promise<void> {
		const canProceed: 'ok' = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'PIPELINE_DEALS_PAGE.RECORD_TYPE',
						this.deal
					)
				}
			})
			.onClose.toPromise();

		if ('ok' === canProceed) {
			await this.dealsService.delete(this.deal.id);
			this.updateViewData();
			delete this.deal;
		}
	}

	private updateViewData(): void {
		this.activatedRoute.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async ({ pipelineId }) => {
				await this.pipelinesService
					.find(['stages'], {
						id: pipelineId
					})
					.then(({ items: [value] }) => (this.pipeline = value));

				this._checkOrganization()

				await this.pipelinesService
					.findDeals(pipelineId)
					.then(({ items }) => {
						items.forEach((deal) => {
							deal.stage = this.pipeline.stages.find(
								({ id }) => id === deal.stageId
							);
						});
						this.deals.load(items);
						this.dealsData = items;
						this.filterDealsByStage();
					});
			});
	}

	private _checkOrganization() {
		this.store.selectedOrganization$
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((org) => {
					this._selectedOrganizationId = org.id;

					if (this.pipeline?.organizationId !== this._selectedOrganizationId) {
						this.router.navigate(['pages/sales/pipelines']);
					}
			})
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
