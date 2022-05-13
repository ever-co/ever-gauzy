import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
	IPipeline,
	ComponentLayoutStyleEnum,
	IOrganization,
	PipelineTabsEnum
} from '@gauzy/contracts';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { Subject, firstValueFrom, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, tap } from 'rxjs/operators';
import { distinctUntilChange } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import {
	ErrorHandlingService,
	PipelinesService,
	Store,
	ToastrService
} from '../../@core/services';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { InputFilterComponent } from '../../@shared/table-filters';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { StageComponent } from './stage/stage.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './pipelines.component.html',
	selector: 'ga-pipelines',
	styleUrls: ['./pipelines.component.scss']
})
export class PipelinesComponent extends PaginationFilterBaseComponent 
	implements OnInit, OnDestroy {

	smartTableSettings: object;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	smartTableSource: ServerDataSource;
	pipelines: IPipeline[] = [];
	viewComponentName: ComponentEnum;
	pipeline: IPipeline;
	organization: IOrganization;
	name: string;
	disableButton: boolean = true;
	loading: boolean = false;

    public inputControl = new FormControl();
	
	pipelineTabsEnum = PipelineTabsEnum;
	pipelines$: Subject<any> = this.subject$;
	nbTab$: Subject<string> = new BehaviorSubject(PipelineTabsEnum.ACTIONS);

	pipelineTable: Ng2SmartTableComponent;
	@ViewChild('pipelineTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.pipelineTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly pipelinesService: PipelinesService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly httpClient: HttpClient,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.pipelines$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getPipelines()),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbTab$
			.pipe(
				distinctUntilChange(),
				debounceTime(100),
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.pipelines$.next(true))
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.pipelines$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.pipelines$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.inputControl.valueChanges
            .pipe(
                debounceTime(500),
                distinctUntilChanged(),
				tap((value) => this.setFilter({ field: 'name', search: value })),
				untilDestroyed(this)
            )
            .subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PROPOSALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.pipelineTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_RESULT'),
			columns: {
				name: {
					type: 'string',
					title: this.getTranslation('SM_TABLE.NAME'),
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'name', search: value });
					}
				},
				description: {
					type: 'string',
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'description', search: value });
					}
				},
				stages: {
					title: this.getTranslation('SM_TABLE.STAGE'),
					type: 'custom',
					filter: false,
					renderComponent: StageComponent
				},
				status: {
					filter: false,
					editor: false,
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '10%',
					renderComponent: StatusBadgeComponent
				}
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	* Register Smart Table Source Config
	*/
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/pipelines/pagination`,
			relations: [ 'stages' ],
			where: {
				...{ organizationId, tenantId },
				...this.filters.where
			},
			resultMap: (pipeline: IPipeline) => {
				return Object.assign({}, pipeline, {
					status: this.statusMapper(pipeline.isActive)
				});
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private statusMapper = (value: string | boolean) => {
		const badgeClass = value ? 'success' : 'warning';
		value = value
			? this.getTranslation('PIPELINES_PAGE.ACTIVE')
			: this.getTranslation('PIPELINES_PAGE.INACTIVE');
		return {
			text: value,
			class: badgeClass
		};
	}

	async getPipelines() {
		if (!this.organization) {
			return;
		}

		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);
			if (
				this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID
			) {
				// Initiate GRID view pagination
				await this.smartTableSource.getElements();
				this.pipelines = this.smartTableSource.getData();

				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	async deletePipeline(selectedItem?: IPipeline): Promise<void> {
		if (selectedItem) {
			this.selectPipeline({
				isSelected: true,
				data: selectedItem
			});
		}

		const canProceed: 'ok' = await firstValueFrom(this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'PIPELINES_PAGE.RECORD_TYPE',
						this.pipeline
					)
				}
			})
			.onClose);

		if ('ok' === canProceed) {
			await this.pipelinesService.delete(this.pipeline.id);
			this.toastrService.success('TOASTR.MESSAGE.PIPELINE_DELETED', {
				name: this.pipeline.name
			});
			this.pipelines$.next(true);
		}
	}

	async createPipeline(): Promise<void> {
		if (!this.organization) {
			return;
		}
		const { name } = this;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		await this.goto({ pipeline: { name, organizationId, tenantId } });
		delete this.name;
	}

	async editPipeline(selectedItem?: IPipeline): Promise<void> {
		if (selectedItem) {
			this.selectPipeline({
				isSelected: true,
				data: selectedItem
			});
		}

		const { pipeline } = this;
		await this.goto({ pipeline });
		delete this.name;
	}

	private async goto(context: Record<any, any>): Promise<void> {
		const dialogRef = this.dialogService.open(PipelineFormComponent, {
			context
		});
		const data = await firstValueFrom(dialogRef.onClose);
		const {
			pipeline: { id, name }
		} = context;

		if (data) {
			id
				? this.toastrService.success(
						`TOASTR.MESSAGE.PIPELINE_UPDATED`,
						{
							name
						}
				  )
				: this.toastrService.success(
						`TOASTR.MESSAGE.PIPELINE_CREATED`,
						{
							name: data.name
						}
				  );
			this.pipelines$.next(true);
		}
	}

	viewDeals(selectedItem?: IPipeline) {
		if (selectedItem) {
			this.selectPipeline({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([`/pages/sales/pipelines/${this.pipeline.id}/deals`]);
	}

	selectPipeline({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.pipeline = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectPipeline({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.pipelineTable && this.pipelineTable.grid) {
			this.pipelineTable.grid.dataSet['willSelect'] = 'false';
			this.pipelineTable.grid.dataSet.deselectAll();
		}
	}

  	onChangeStatus(event){
    	this.setFilter({ field: 'isActive', search: event });
  	}

	onChangeTab(tab: NbTabComponent) {
		this.nbTab$.next(tab.tabId);
	}

	ngOnDestroy(): void {}
}
