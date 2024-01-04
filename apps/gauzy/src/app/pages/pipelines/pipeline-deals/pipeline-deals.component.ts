import { Component, OnInit, OnDestroy } from '@angular/core';
import { IDeal, IPipeline, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import {
	ActivatedRoute,
	Router
} from '@angular/router';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DealsService } from '../../../@core/services/deals.service';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { Store } from '../../../@core/services/store.service';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
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
export class PipelineDealsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {

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
	public disableButton = true;
	public readonly smartTableSettings = {
		actions: false,
		noDataMessage: '-',
		selectedRowIndex: -1,
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
				renderComponent: PipelineDealExcerptComponent,
				componentInitFunction: (instance: PipelineDealExcerptComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}

			},
			createdBy: {
				title: 'Created by',
				type: 'custom',
				renderComponent: PipelineDealCreatedByComponent,
				componentInitFunction: (instance: PipelineDealCreatedByComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}
			},
			probability: {
				title: 'Probability',
				type: 'custom',
				width: '15%',
				class: 'text-center',
				renderComponent: PipelineDealProbabilityComponent,
				componentInitFunction: (instance: PipelineDealProbabilityComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}
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
		this.smartTableSettings.noDataMessage = this.getTranslation('SM_TABLE.NO_RESULT');
		this.smartTableSettings.columns.title.title = this.getTranslation('SM_TABLE.TITLE');
		this.smartTableSettings.columns.stage.title = this.getTranslation('SM_TABLE.STAGE');
		this.smartTableSettings.columns.createdBy.title = this.getTranslation('SM_TABLE.CREATED_BY');
		this.smartTableSettings.columns.probability.title = this.getTranslation('PIPELINE_DEAL_CREATE_PAGE.PROBABILITY');
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
		const canProceed: 'ok' = await firstValueFrom(
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType: this.getTranslation(
							'PIPELINE_DEALS_PAGE.RECORD_TYPE',
							this.deal
						)
					}
				})
				.onClose
		);

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
	}

	ngOnDestroy() { }
}
