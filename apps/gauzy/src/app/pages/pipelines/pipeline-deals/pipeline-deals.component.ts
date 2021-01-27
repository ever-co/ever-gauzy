import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IDeal, IPipeline, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DealsService } from '../../../@core/services/deals.service';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { Store } from '../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
import { PipelineDealCreatedByComponent } from '../table-components/pipeline-deal-created-by/pipeline-deal-created-by';
import { PipelineDealExcerptComponent } from '../table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from '../table-components/pipeline-deal-probability/pipeline-deal-probability.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pipeline-deals',
	templateUrl: './pipeline-deals.component.html',
	styleUrls: ['./pipeline-deals.component.scss']
})
export class PipelineDealsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	deals = new LocalDataSource([] as IDeal[]);
	dealsData: IDeal[];
	filteredDeals: IDeal[];
	pipeline: IPipeline;
	stageId: string;
	deal: IDeal;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	loading: boolean;

	private _selectedOrganizationId: string;
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
	disableButton = true;

	pipelineDealsTable: Ng2SmartTableComponent;
	@ViewChild('pipelineDealsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.pipelineDealsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public translateService: TranslateService,
		private dealsService: DealsService,
		private dialogService: NbDialogService,
		private activatedRoute: ActivatedRoute,
		private pipelinesService: PipelinesService,
		private router: Router,
		private store: Store,
		private toastrService: ToastrService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				untilDestroyed(this)
			)
			.subscribe((user) => {
				this.updateViewData();
			});

		this.smartTableSettings.noDataMessage = this.getTranslation(
			'SM_TABLE.NO_RESULT'
		);
		this.smartTableSettings.columns.title.title = this.getTranslation(
			'SM_TABLE.TITLE'
		);
		this.smartTableSettings.columns.stage.title = this.getTranslation(
			'SM_TABLE.STAGE'
		);
		this.smartTableSettings.columns.createdBy.title = this.getTranslation(
			'SM_TABLE.CREATED_BY'
		);

		this.router.events
			.pipe(untilDestroyed(this))
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
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.pipelineDealsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	filterDealsByStage(): void {
		const { stageId: search = '' } = this;

		this.deals.setFilter([{ field: 'stageId', search }]);

		if (this.stageId) {
			this.filteredDeals = this.dealsData.filter(
				(deal) => deal.stageId === this.stageId
			);
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
			this.toastrService.success('PIPELINE_DEALS_PAGE.DEAL_DELETED', {
				name: this.deal.title
			});
			delete this.deal;
		}
	}

	private updateViewData(): void {
		this.loading = true;
		this.activatedRoute.params
			.pipe(untilDestroyed(this))
			.subscribe(async ({ pipelineId }) => {
				const { tenantId } = this.store.user;
				await this.pipelinesService
					.getAll(['stages'], {
						id: pipelineId,
						tenantId
					})
					.then(({ items: [value] }) => (this.pipeline = value));

				this._checkOrganization();

				await this.pipelinesService
					.findDeals(pipelineId, { tenantId })
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
		this.loading = false;
	}

	private _checkOrganization() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				this._selectedOrganizationId = org.id;
				if (
					this.pipeline?.organizationId !==
					this._selectedOrganizationId
				) {
					this.router.navigate(['pages/sales/pipelines']);
				}
			});
	}

	selectPipelineDeals({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.deal = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectPipelineDeals({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.pipelineDealsTable && this.pipelineDealsTable.grid) {
			this.pipelineDealsTable.grid.dataSet['willSelect'] = 'false';
			this.pipelineDealsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
