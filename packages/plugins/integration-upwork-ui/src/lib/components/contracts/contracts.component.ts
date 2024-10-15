import { Component, OnInit, OnDestroy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Observable, of, EMPTY, firstValueFrom, filter, catchError, tap } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Cell } from 'angular2-smart-table';
import * as moment from 'moment';
import { IEngagement } from '@gauzy/contracts';
import { ErrorHandlingService, ToastrService, UpworkStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DateViewComponent } from '@gauzy/ui-core/shared';
import { SyncDataSelectionComponent } from '../sync-data-selection/sync-data-selection.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-contracts',
	templateUrl: './contracts.component.html',
	styleUrls: ['./contracts.component.scss'],
	providers: [TitleCasePipe]
})
export class ContractsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public smartTableSettings: any;
	public contracts$: Observable<IEngagement[]> = this._upworkStoreServices.contracts$;
	public selectedContracts: IEngagement[] = [];

	constructor(
		public readonly translateService: TranslateService,
		private readonly _upworkStoreServices: UpworkStoreService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _nbDialogService: NbDialogService,
		private readonly _route: ActivatedRoute,
		private readonly _titleCasePipe: TitleCasePipe
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this._loadContracts();

		// Subscribe to changes in the query parameters
		this._route.queryParamMap
			.pipe(
				// Filter out unwanted changes and only proceed if 'openAddDialog' is 'true'
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				// Debounce the changes to avoid rapid triggering
				// Execute the addIncome method when conditions are met
				tap(() => this.manageEntitiesSync()),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads contracts from Upwork and handles errors.
	 * This method subscribes to the getContracts method of _upworkStoreServices.
	 */
	private _loadContracts(): void {
		this._upworkStoreServices
			.getContracts()
			.pipe(
				// Handle errors using the _errorHandlingService.handleError method
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					// Return an observable with a null value to continue the stream
					return of(null);
				}),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads Smart Table settings for displaying contracts.
	 * This method configures the select mode, actions, mode, and columns for the Smart Table.
	 */
	private _loadSmartTableSettings(): void {
		// Configure Smart Table settings
		this.smartTableSettings = {
			selectedRowIndex: -1, // Initialize the selected row index
			selectMode: 'multi',
			actions: {
				add: false,
				edit: false,
				delete: false,
				select: true
			},
			mode: 'external',
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.CONTRACT'),
			columns: {
				engagement_start_date: {
					title: this.getTranslation('SM_TABLE.START_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					valuePrepareFunction: (value: string) => moment.unix(parseInt(value) / 1000),
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				engagement_end_date: {
					title: this.getTranslation('SM_TABLE.END_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					isFilterable: false,
					valuePrepareFunction: (value: string) => moment.unix(parseInt(value) / 1000),
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				job__title: {
					title: this.getTranslation('SM_TABLE.JOB_TITLE'),
					type: 'string'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					valuePrepareFunction: (value: string) => this._titleCasePipe.transform(value)
				}
			}
		};
	}

	/**
	 * Handles selection of contracts.
	 *
	 * @param selected The selected contracts array.
	 */
	selectContract({ selected }): void {
		this.selectedContracts = selected;
	}

	/**
	 * Opens a dialog to manage entity synchronization.
	 * Waits for the dialog to close before resolving.
	 */
	async manageEntitiesSync(): Promise<void> {
		try {
			if (this.selectedContracts.length > 0) {
				// Open the dialog for syncing data selection
				const dialog = this._nbDialogService.open(SyncDataSelectionComponent, {
					context: {
						contracts: this.selectedContracts
					}
				});

				// Wait for the dialog to close using firstValueFrom
				await firstValueFrom(dialog.onClose);
			}
		} catch (error) {
			// Handle any errors that may occur during the process
			console.error('Error in manageEntitiesSync:', error);
			// Optionally display an error message or handle the error accordingly
		}
	}

	/**
	 * Initiates the synchronization of selected contracts with Upwork.
	 * Displays a success toast upon successful synchronization.
	 */
	syncContracts(): void {
		// Trigger the synchronization of selected contracts using _upworkStoreServices
		this._upworkStoreServices
			.syncContracts(this.selectedContracts)
			.pipe(
				// Display a success toast upon successful synchronization
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.UPWORK_PAGE.SYNCED_CONTRACTS'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				// Handle errors using the _ehs.handleError method and return an EMPTY observable
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Listens for language changes and applies translations to Smart Table settings accordingly.
	 * This method subscribes to the onLangChange event from the translateService.
	 */
	private _applyTranslationOnSmartTable(): void {
		// Subscribe to language changes using onLangChange
		this.translateService.onLangChange
			.pipe(
				// Trigger the loading of Smart Table settings when the language changes
				tap(() => this._loadSmartTableSettings()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
