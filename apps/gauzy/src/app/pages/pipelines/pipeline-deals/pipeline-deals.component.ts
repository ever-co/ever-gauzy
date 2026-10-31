import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Data, ParamMap, Router } from '@angular/router';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { IDeal, IPipeline, ComponentLayoutStyleEnum, IOrganization, ID, IPagination } from '@gauzy/contracts';
import { ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import { DealsService, ErrorHandlingService, PipelinesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { debounceTime, distinctUntilChanged, filter, tap } from 'rxjs/operators';
import { catchError, combineLatest, firstValueFrom, map, Observable, of, Subject, switchMap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	CreatedByUserComponent,
	DeleteConfirmationComponent,
	IPaginationBase,
	PaginationFilterBaseComponent
} from '@gauzy/ui-core/shared';
import { PipelineDealExcerptComponent } from '../table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from '../table-components/pipeline-deal-probability/pipeline-deal-probability.component';
import { IDealStageMove } from './pipeline-deals-board/pipeline-deals-board.component';
import { DealBoardMoves } from './pipeline-deals-board/pipeline-deals-board.utils';

/** The `view` query parameter that opens the deals as a board, so the board can be linked to and survives a reload. */
export const DEALS_BOARD_VIEW = 'board';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pipeline-deals',
	templateUrl: './pipeline-deals.component.html',
	styleUrls: ['./pipeline-deals.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class PipelineDealsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public viewComponentName: ComponentEnum = ComponentEnum.PIPELINE_DEALS;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public stageFormControl: FormControl = new FormControl();
	public refresh$: Subject<boolean> = new Subject();
	public smartTableSource: LocalDataSource = new LocalDataSource([] as IDeal[]);
	public smartTableSettings: object;
	public deals: IDeal[] = [];
	public selectedDeal: IDeal;
	public loading: boolean = false;
	public disableButton: boolean = true;
	public organization: IOrganization;
	public pipeline: IPipeline;
	public pipeline$: Observable<IPipeline>;
	public deals$: Observable<IDeal[]>;
	/** The deals shown as a board, one column per stage, in place of the table or the cards grid (opt-in). */
	public isBoardView = false;
	/** Deals moved on the board: once their saves settle, the table and grid read the deals again. */
	private readonly _boardMoves = new DealBoardMoves();
	/** Emits each time a read of the deals ends, whether it succeeded or failed. */
	private readonly _dealsRead$ = new Subject<void>();

	/**
	 * The board was left while its moves were saving: it shows again once they settle and the deals have been
	 * read again, so it is never built from deals read before the moves (see {@link DealBoardMoves}).
	 */
	public get isBoardHeld(): boolean {
		return this._boardMoves.held;
	}

	/**
	 * Checks if the current layout style is grid.
	 */
	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID;
	}

	/**
	 * Public getter to be used in the template.
	 */
	public get isGridLayout(): boolean {
		return this._isGridLayout;
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _dealsService: DealsService,
		private readonly _dialogService: NbDialogService,
		private readonly _pipelinesService: PipelinesService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();

		this.pipeline$ = this._activatedRoute.params.pipe(
			// Filter for the presence of pipelineId in route params
			filter(({ pipelineId }) => !!pipelineId),
			// Switch to route data stream once pipelineId is confirmed
			switchMap(() => this._activatedRoute.data),
			// Exclude falsy values from the emitted values
			filter(({ pipeline }: Data) => !!pipeline),
			// Map the pipeline to the pipeline property
			map(({ pipeline }: Data) => pipeline),
			// Tap operator for side effects - setting the form property
			tap((pipeline: IPipeline) => (this.pipeline = pipeline)),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);

		// Combine pipeline$ and subject$
		this.deals$ = combineLatest([this.pipeline$, this.subject$]).pipe(
			tap(() => {
				this.loading = true;
			}),
			switchMap(([pipeline, _]) => {
				// Extract pipeline properties
				const { id: pipelineId, organizationId, tenantId } = pipeline;

				// Fetch pipeline deals
				return this._pipelinesService.getPipelineDeals(
					pipelineId,
					{
						organizationId,
						tenantId
					},
					// `client`: the board's cards name the deal's client.
					['stage', 'createdByUser', 'client']
				);
			}),
			// Map the contacts to the clients property
			map(({ items }: IPagination<IDeal>) => items),
			// Tap operator for side effects - setting the deals property
			tap((deals) => this.getPipelineDeals(deals)),
			// Catch errors
			catchError((error) => {
				console.error('Error fetching pipeline deals:', error);
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			tap(() => {
				this.loading = false;
				this._dealsRead$.next();
			}),
			untilDestroyed(this)
		);

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

		this.refresh$
			.pipe(
				filter(() => this.isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.deals = [])),
				untilDestroyed(this)
			)
			.subscribe();

		// The board view follows the `view` query parameter, so it can be linked to and survives a reload.
		this._activatedRoute.queryParamMap
			.pipe(
				map((params: ParamMap) => params.get('view') === DEALS_BOARD_VIEW),
				distinctUntilChanged(),
				tap((isBoardView: boolean) => this._applyBoardView(isBoardView)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens the deals as a board, or goes back to the table or cards grid the layout selector chose.
	 */
	toggleBoardView(): void {
		this._router.navigate([], {
			relativeTo: this._activatedRoute,
			queryParams: { view: this.isBoardView ? null : DEALS_BOARD_VIEW },
			queryParamsHandling: 'merge'
		});
	}

	/**
	 * A deal is being saved at another stage from the board.
	 *
	 * @param move The move, with its save.
	 */
	onBoardDealMoving(move: IDealStageMove): void {
		this._boardMoves.track(move.saved);
	}

	/**
	 * Shows or leaves the board.
	 *
	 * @param isBoardView Whether the deals show as a board.
	 */
	private _applyBoardView(isBoardView: boolean): void {
		this.isBoardView = isBoardView;
		// A row picked in the table has no card standing for it on the board.
		this.clearItem();
		// Back from a board where deals moved: once the saves still under way settle, the table and grid read
		// the deals again (leaving the board removed it, so it can no longer report them).
		if (!isBoardView) {
			void this._boardMoves.settle(() => this._readDealsAgain()).finally(() => this._cdr.markForCheck());
		}
	}

	/**
	 * Reads the deals again, resolving once the read ends. The read starts at once and marks the page as
	 * loading; a list that stopped reading after an earlier failure has nothing to wait for.
	 */
	private _readDealsAgain(): Promise<void> {
		const read = firstValueFrom(this._dealsRead$);
		this.subject$.next(true);
		return this.loading ? read : Promise.resolve();
	}

	ngAfterViewInit() {
		this._cdr.detectChanges();
	}

	/**
	 * Fetches and sets the pipeline deals.
	 */
	async getPipelineDeals(deals: IDeal[]): Promise<void> {
		if (!this.pipeline) {
			return;
		}

		// Add stage to deals
		deals = deals.map((deal) => ({
			...deal,
			stage: this.pipeline.stages.find(({ id }) => id === deal.stageId)
		}));

		// Set the smart table source
		this.smartTableSource = new LocalDataSource();
		await this.smartTableSource.load(deals);

		// Get pagination details
		const { activePage, itemsPerPage } = this.getPagination();

		// Set paging for the smart table source
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);

		this.setPagination({
			...this.getPagination(),
			totalItems: this.deals.length
		});

		// Set the smart table source
		this._loadDataGridLayout();
	}

	/**
	 * Sets the view based on the selected component layout style.
	 */
	setView() {
		this._store
			.componentLayout$(this.viewComponentName)
			.pipe(
				// Only emit a new value if it's distinct from the previous one
				distinctUntilChange(),
				// Update the dataLayoutStyle based on the component layout
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				// Trigger pagination refresh
				tap(() => this.refreshPagination()),
				// filter grid layout
				filter(() => this.isGridLayout),
				// Clear deals
				tap(() => {
					this.deals = [];
					this.stageFormControl.reset();
				}),
				// emit value immediately
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets up a ServerDataSource for retrieving pipeline deals from a server.
	 */
	private _loadSmartTableSettings() {
		// Get pagination details
		const pagination: IPaginationBase = this.getPagination();

		// Set up smart table settings
		this.smartTableSettings = {
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_RESULT'),
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			columns: {
				title: {
					title: this.getTranslation('SM_TABLE.TITLE'),
					type: 'string',
					isFilterable: true,
					width: '30%'
				},
				stage: {
					title: this.getTranslation('SM_TABLE.STAGE'),
					type: 'custom',
					width: '30%',
					isFilterable: false,
					renderComponent: PipelineDealExcerptComponent,
					componentInitFunction: (instance: PipelineDealExcerptComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				createdByUser: {
					title: this.getTranslation('SM_TABLE.CREATED_BY'),
					type: 'custom',
					width: '30%',
					isFilterable: false,
					renderComponent: CreatedByUserComponent<IDeal>,
					componentInitFunction: (instance: CreatedByUserComponent<IDeal>, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				probability: {
					title: this.getTranslation('PIPELINE_DEAL_CREATE_PAGE.PROBABILITY'),
					type: 'custom',
					isFilterable: true,
					width: '10%',
					class: 'text-center',
					renderComponent: PipelineDealProbabilityComponent,
					componentInitFunction: (instance: PipelineDealProbabilityComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	/**
	 * Loads data in grid layout if the current layout style is grid.
	 */
	private async _loadDataGridLayout(): Promise<void> {
		if (this.isGridLayout) {
			try {
				const deals: IDeal[] = await this.smartTableSource.getElements();
				this.deals = deals; // Override the existing array with fetched deals
			} catch (error) {
				console.error('Error loading grid layout data:', error);
				this._errorHandlingService.handleError(error);
			}
		}
	}

	/**
	 * Filter deals in the smart table data source by stageId.
	 */
	async filterDealsByStage(stageId: ID): Promise<void> {
		// Set header selectors filters configuration
		this.smartTableSource.setFilter(
			[
				...(stageId
					? [
							{
								field: 'stageId',
								search: stageId
							}
					  ]
					: [])
			],
			true
		);

		if (this.isGridLayout) {
			try {
				const deals: IDeal[] = await this.smartTableSource.getElements();
				this.deals = deals; // Override the existing array with fetched deals
			} catch (error) {
				console.error('Error loading grid layout data:', error);
				this._errorHandlingService.handleError(error);
			}
		}
	}

	/**
	 * Deletes the current deal after user confirmation.
	 */
	async deleteDeal(): Promise<void> {
		// Open a dialog to handle manual job application
		const dialog = this._dialogService.open(DeleteConfirmationComponent, {
			context: {
				recordType: this.getTranslation('PIPELINE_DEALS_PAGE.RECORD_TYPE', this.selectedDeal)
			},
			hasScroll: false
		});

		try {
			// Wait for dialog result
			const canProceed = await firstValueFrom(dialog.onClose);

			// Process job application if result is available
			if ('ok' === canProceed) {
				await this._dealsService.delete(this.selectedDeal.id);
				this._toastrService.success('PIPELINE_DEALS_PAGE.DEAL_DELETED', { name: this.selectedDeal.title });
			}
		} catch (error) {
			console.log('Error while deleting pipeline deal', error);
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		} finally {
			this.subject$.next(true);
		}
	}

	/**
	 * Loads more deals when the user scrolls (pagination).
	 */
	loadMoreDeals(): void {
		super.onScroll();
	}

	/**
	 * Select or deselect pipeline deals
	 *
	 * @param param0 An object containing `isSelected` and `data`
	 */
	selectPipelineDeals({ isSelected, data }: { isSelected: boolean; data: any }): void {
		this.disableButton = !isSelected;
		this.selectedDeal = isSelected ? data : null;
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

	/**
	 * Listens for language changes and triggers the loading of Smart Table settings.
	 * Unsubscribes when the component is destroyed.
	 */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
