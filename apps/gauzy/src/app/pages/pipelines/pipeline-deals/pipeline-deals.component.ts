import { Component, OnInit, OnDestroy } from '@angular/core';
import { IDeal, IPipeline, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { PipelinesService } from '../../../@core/services/pipelines.service';
import { ActivatedRoute, Router } from '@angular/router';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DealsService } from '../../../@core/services/deals.service';
import { ComponentEnum } from '@gauzy/ui-sdk/common';
import { Store } from '../../../@core/services/store.service';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { firstValueFrom, Subject } from 'rxjs';
import { PipelineDealCreatedByComponent } from '../table-components/pipeline-deal-created-by/pipeline-deal-created-by';
import { PipelineDealExcerptComponent } from '../table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from '../table-components/pipeline-deal-probability/pipeline-deal-probability.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../../@shared/pagination/pagination-filter-base.component';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pipeline-deals',
	templateUrl: './pipeline-deals.component.html',
	styleUrls: ['./pipeline-deals.component.scss']
})
export class PipelineDealsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	private _selectedOrganizationId: string;
	private _refresh$: Subject<boolean> = new Subject();
	deals = new LocalDataSource([] as IDeal[]);
	dealsData: IDeal[];
	filteredDeals: IDeal[];
	pipeline: IPipeline;
	stageId: string;
	deal: IDeal;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	loading: boolean;
	public disableButton = true;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
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
	public gridDeals: IDeal[] = [];

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

	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID;
	}

	private updateViewData(): void {
		this.loading = true;
		this.activatedRoute.params.pipe(untilDestroyed(this)).subscribe(async ({ pipelineId }) => {
			const { tenantId } = this.store.user;
			await this.pipelinesService
				.getAll(['stages'], {
					id: pipelineId,
					tenantId
				})
				.then(({ items: [value] }) => (this.pipeline = value));

			this._checkOrganization();

			await this.pipelinesService.findDeals(pipelineId, { tenantId }).then(async ({ items }) => {
				items.forEach((deal) => {
					deal.stage = this.pipeline.stages.find(({ id }) => id === deal.stageId);
				});
				// Get pagination settings
				const { activePage, itemsPerPage } = this.getPagination();
				// Set paging for the Smart Table source
				this.deals.setPaging(activePage, itemsPerPage, false);
				await this.deals.load(items);
				this.dealsData = items;
				this.filterDealsByStage();
				await this._loadDataGridLayout();
				this.setPagination({
					...this.getPagination(),
					totalItems: this.deals.count()
				});
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
				if (this.pipeline?.organizationId !== this._selectedOrganizationId) {
					this.router.navigate(['pages/sales/pipelines']);
				}
			});
	}

	private loadSmartTableSource(): void {
		const pagination: IPaginationBase = this.getPagination();
		//this.smartTableSettings.
		this.smartTableSettings.noDataMessage = this.getTranslation('SM_TABLE.NO_RESULT');
		this.smartTableSettings.columns.title.title = this.getTranslation('SM_TABLE.TITLE');
		this.smartTableSettings.columns.stage.title = this.getTranslation('SM_TABLE.STAGE');
		this.smartTableSettings.columns.createdBy.title = this.getTranslation('SM_TABLE.CREATED_BY');
		this.smartTableSettings.columns.probability.title = this.getTranslation(
			'PIPELINE_DEAL_CREATE_PAGE.PROBABILITY'
		);
		// Configure Smart Table settings
		Object.assign(this.smartTableSettings, {
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			}
		});
	}

	private async _loadDataGridLayout() {
		if (this._isGridLayout) {
			const deals: IDeal[] = await this.deals.getElements();
			this.gridDeals.push(...deals);
		}
	}

	ngOnInit(): void {
		this.loadSmartTableSource();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.updateViewData()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure distinct values are emitted
				distinctUntilChange(),
				// Update view
				tap(() => this.subject$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.gridDeals = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PIPELINE_DEALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				// Wait for 300 milliseconds of inactivity
				debounceTime(300),
				// Only emit a new value if it's distinct from the previous one
				distinctUntilChange(),
				// Update the dataLayoutStyle based on the component layout
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				// Trigger pagination refresh
				tap(() => this.refreshPagination()),
				// filter grid layout
				filter(() => this._isGridLayout),
				tap(() => (this.gridDeals = [])),
				// emit value immediately
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	filterDealsByStage(): void {
		const { stageId: search = '' } = this;

		this.deals.setFilter([{ field: 'stageId', search }]);

		if (this.stageId) {
			this.filteredDeals = this.dealsData.filter((deal) => deal.stageId === this.stageId);
		} else {
			this.filteredDeals = this.dealsData;
		}
	}

	async deleteDeal(): Promise<void> {
		const canProceed: 'ok' = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('PIPELINE_DEALS_PAGE.RECORD_TYPE', this.deal)
				}
			}).onClose
		);

		if ('ok' === canProceed) {
			await this.dealsService.delete(this.deal.id);
			this.subject$.next(true);
			this.toastrService.success('PIPELINE_DEALS_PAGE.DEAL_DELETED', {
				name: this.deal.title
			});
			delete this.deal;
		}
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

	ngOnDestroy() {}
}
