import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { Observable, of, EMPTY, firstValueFrom, filter } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Cell } from 'angular2-smart-table';
import * as moment from 'moment';
import { IEngagement } from '@gauzy/contracts';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import { UpworkStoreService } from '@gauzy/ui-sdk/core';
import { DateViewComponent } from './../../../../@shared/table-components';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { SyncDataSelectionComponent } from '../sync-data-selection/sync-data-selection.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-contracts',
	templateUrl: './contracts.component.html',
	styleUrls: ['./contracts.component.scss'],
	providers: [TitleCasePipe]
})
export class ContractsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public contracts$: Observable<IEngagement[]> = this._upworkStoreServices.contracts$;
	public smartTableSettings: object;
	public selectedContracts: IEngagement[] = [];

	constructor(
		private readonly _upworkStoreServices: UpworkStoreService,
		private readonly toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly _nbDialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly titleCasePipe: TitleCasePipe
	) {
		super(translateService);
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

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this._loadContracts();

		// Subscribe to changes in the query parameters
		this.route.queryParamMap
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
	 * Loads Smart Table settings for displaying contracts.
	 * This method configures the select mode, actions, mode, and columns for the Smart Table.
	 */
	_loadSmartTableSettings(): void {
		// Configure Smart Table settings
		this.smartTableSettings = {
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
					filter: false,
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
					filter: false,
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
					valuePrepareFunction: (value: string) => this.titleCasePipe.transform(value)
				}
			}
		};
	}

	/**
	 *
	 * @param param0
	 */
	selectContract({ selected }) {
		this.selectedContracts = selected;
	}

	async manageEntitiesSync(): Promise<void> {
		try {
			// Open the dialog for syncing data selection
			const dialog = this._nbDialogService.open(SyncDataSelectionComponent, {
				context: {
					contracts: this.selectedContracts
				}
			});

			// Wait for the dialog to close using firstValueFrom
			await firstValueFrom(dialog.onClose);
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
					this.toastrService.success(
						this.getTranslation('INTEGRATIONS.UPWORK_PAGE.SYNCED_CONTRACTS'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				// Handle errors using the _ehs.handleError method and return an EMPTY observable
				catchError((err) => {
					this._errorHandlingService.handleError(err);
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
