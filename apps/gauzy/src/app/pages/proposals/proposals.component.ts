import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Cell } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	IProposal,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProposalViewModel,
	ProposalStatusEnum,
	IOrganizationContact,
	IDateRangePicker,
	ITag,
	PermissionsEnum,
	IEmployee
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	ProposalsService,
	ServerDataSource,
	ToastrService
} from '@gauzy/ui-sdk/core';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange, toUTC } from '@gauzy/ui-sdk/common';
import {
	ActionConfirmationComponent,
	ClickableLinkComponent,
	ContactLinksComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	EmployeeLinksComponent,
	IPaginationBase,
	NotesWithTagsComponent,
	PaginationFilterBaseComponent,
	TagsOnlyComponent,
	getAdjustDateRangeFutureAllowed
} from '@gauzy/ui-sdk/shared';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import {
	InputFilterComponent,
	OrganizationContactFilterComponent,
	TagsColorFilterComponent
} from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public smartTableSettings: object;
	public selectedEmployeeId: IEmployee['id'] | null;
	public selectedDateRange: IDateRangePicker;
	public proposals: IProposalViewModel[];
	public smartTableSource: ServerDataSource;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public viewComponentName: ComponentEnum = ComponentEnum.PROPOSALS;
	public selectedProposal: IProposalViewModel;
	public proposalStatusEnum = ProposalStatusEnum;
	public successRate: string;
	public totalProposals: number;
	public countAccepted: number = 0;
	public loading: boolean = false;
	public disableButton: boolean = true;
	public organization: IOrganization;
	public proposals$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		// Subscribe to changes in the proposals$ observable stream
		this.proposals$
			.pipe(
				// Wait for 100 milliseconds to debounce rapid changes
				debounceTime(100),
				// Clear the selected item
				tap(() => this.clearItem()),
				// Retrieve and update the proposals
				tap(() => this.getProposals()),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the pagination$ observable stream
		this.pagination$
			.pipe(
				// Wait for 100 milliseconds to debounce rapid changes
				debounceTime(100),
				// Only react when the pagination value changes
				distinctUntilChange(),
				// Trigger a refresh of proposals
				tap(() => this.proposals$.next(true)),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Combine observable streams to react to changes in organization, date range, and employee
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeDateRange$, storeEmployee$])
			.pipe(
				// Wait for 500 milliseconds to debounce rapid changes
				debounceTime(500),
				// Only react when both organization and date range are available
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				// Only react when there's a change in the combined values
				distinctUntilChange(),
				// Update component properties based on the latest values
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				// Trigger refresh actions
				tap(() => this._refresh$.next(true)),
				tap(() => this.proposals$.next(true)),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the _refresh$ observable stream
		this._refresh$
			.pipe(
				// Only react when the data layout style is CARDS_GRID
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				// Trigger a refresh of pagination
				tap(() => this.refreshPagination()),
				// Reset the proposals array
				tap(() => (this.proposals = [])),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		// Check if a user exists in the store and the user lacks a specific permission
		if (this.store.user && !this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Delete the 'author' column from the smartTableSettings.columns object
			delete this.smartTableSettings['columns']['author'];

			// Clone the smartTableSettings object to trigger change detection
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	/**
	 * Sets the view based on the component layout.
	 */
	setView(): void {
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				// If the layout style is CARDS_GRID, reset the proposals array
				tap(() => (this.proposals = [])),
				// Trigger a refresh of proposals
				tap(() => this.proposals$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Navigates to the details page of a proposal.
	 * @param selectedItem - The proposal item for which details are to be displayed.
	 */
	details(selectedItem?: IProposal): void {
		// If a proposal item is selected, mark it as selected
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}

		// If a proposal is selected, navigate to its details page
		if (this.selectedProposal) {
			this.router.navigate([`/pages/sales/proposals/details`, this.selectedProposal.id]);
		}
	}

	/**
	 * Deletes a proposal after user confirmation.
	 * @param selectedItem - The proposal item to be deleted.
	 */
	delete(selectedItem?: IProposal): void {
		// If a proposal item is selected, mark it as selected
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the dialog for user confirmation
		const dialogRef = this.dialogService.open(DeleteConfirmationComponent, {
			context: {
				recordType: 'Proposal'
			}
		});

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				// If there is a result and a proposal is selected
				if (dialogResult) {
					if (!this.selectedProposal) {
						return;
					}

					const { id: proposalId } = this.selectedProposal;

					// Delete the proposal
					await this.proposalsService.delete(proposalId);

					// Display a success message
					this.toastrService.success('NOTES.PROPOSALS.DELETE_PROPOSAL');
				}
			} catch (error) {
				// Handle errors during the process
				this.errorHandler.handleError(error);
			} finally {
				// Trigger refresh actions
				this._refresh$.next(true);
				this.proposals$.next(true);
			}
		});
	}

	/**
	 * Switches the status of a proposal to "ACCEPTED" after user confirmation.
	 * @param selectedItem - The proposal item to be switched.
	 */
	switchToAccepted(selectedItem?: IProposal): void {
		// If a proposal item is selected, mark it as selected
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the dialog for user confirmation
		const dialogRef = this.dialogService.open(ActionConfirmationComponent, {
			context: {
				recordType: 'status'
			}
		});

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				// If there is a result and a proposal is selected
				if (dialogResult) {
					if (!this.selectedProposal) {
						return;
					}

					const { id: organizationId, tenantId } = this.organization;
					const { id: proposalId } = this.selectedProposal;

					// Update the proposal status to "ACCEPTED"
					await this.proposalsService.update(proposalId, {
						status: ProposalStatusEnum.ACCEPTED,
						organizationId,
						tenantId
					});

					// TODO: Translate the success message
					this.toastrService.success('NOTES.PROPOSALS.PROPOSAL_ACCEPTED');
				}
			} catch (error) {
				// Handle errors during the process
				this.errorHandler.handleError(error);
			} finally {
				// Trigger refresh actions
				this._refresh$.next(true);
				this.proposals$.next(true);
			}
		});
	}

	/**
	 * Switches the status of a proposal to "SENT" after user confirmation.
	 * @param selectedItem - The proposal item to be switched.
	 */
	switchToSent(selectedItem?: IProposal) {
		// If a proposal item is selected, mark it as selected
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the dialog for user confirmation
		const dialogRef = this.dialogService.open(ActionConfirmationComponent, {
			context: {
				recordType: 'status'
			}
		});

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				// If there is a result, proceed with creating a new income
				if (dialogResult) {
					if (!this.selectedProposal) {
						return;
					}

					const { id: organizationId, tenantId } = this.organization;
					const { id: proposalId } = this.selectedProposal;

					// Update the proposal status to "SENT"
					await this.proposalsService.update(proposalId, {
						status: ProposalStatusEnum.SENT,
						organizationId,
						tenantId
					});

					this.toastrService.success('NOTES.PROPOSALS.PROPOSAL_SENT');
				}
			} catch (error) {
				// Handle errors during the process
				this.errorHandler.handleError(error);
			} finally {
				this._refresh$.next(true);
				this.proposals$.next(true);
			}
		});
	}

	/**
	 * Maps a proposal status to a text label and a corresponding badge class.
	 * @param cell - The proposal status.
	 * @returns {object} - An object containing the text label and badge class.
	 */
	private statusMapper = (cell: string): { text: string; class: string } => {
		let badgeClass: string;
		let statusText: string;

		if (cell === ProposalStatusEnum.SENT) {
			badgeClass = 'warning';
			statusText = this.getTranslation('BUTTONS.SENT');
		} else {
			badgeClass = 'success';
			statusText = this.getTranslation('BUTTONS.ACCEPTED');
		}

		return {
			text: statusText,
			class: badgeClass
		};
	};

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROPOSAL'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '10%',
					filter: false,
					sortDirection: 'desc',
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				jobTitle: {
					title: this.getTranslation('SM_TABLE.JOB_TITLE'),
					type: this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE ? 'custom' : 'string',
					width: '25%',
					renderComponent:
						this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE ? NotesWithTagsComponent : null,
					componentInitFunction: (instance: NotesWithTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'jobPostContent', search: value });
					}
				},
				jobPostUrl: {
					title: this.getTranslation('SM_TABLE.JOB_POST_URL'),
					type: 'custom', // Set column type to 'custom'
					width: '25%',
					filter: false,
					renderComponent: ClickableLinkComponent,
					componentInitFunction: (instance: ClickableLinkComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
						instance.href = 'jobPostUrl';
					}
				},
				organizationContact: {
					title: this.getTranslation('SM_TABLE.CONTACT_NAME'),
					type: 'custom',
					width: '20%',
					renderComponent: ContactLinksComponent,
					componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					},
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact | null) => {
						this.setFilter({
							field: 'organizationContactId',
							search: value?.id || null
						});
					}
				},
				author: {
					title: this.getTranslation('SM_TABLE.AUTHOR'),
					type: 'custom',
					width: '20%',
					filter: false,
					renderComponent: EmployeeLinksComponent,
					valuePrepareFunction: (value: IEmployee) => ({
						id: value?.id,
						name: value?.user?.name,
						fullName: value?.fullName,
						imageUrl: value?.user?.imageUrl
					}),
					componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				statusBadge: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					class: 'text-center',
					filter: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				}
			}
		};
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
			this.smartTableSettings['columns']['tags'] = {
				title: this.getTranslation('SM_TABLE.TAGS'),
				type: 'custom',
				width: '20%',
				class: 'align-row',
				renderComponent: TagsOnlyComponent,
				componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getRawValue();
				},
				filter: {
					type: 'custom',
					component: TagsColorFilterComponent
				},
				filterFunction: (tags: ITag[]) => {
					const tagIds = [];
					for (const tag of tags) {
						tagIds.push(tag.id);
					}
					this.setFilter({ field: 'tags', search: tagIds });
				},
				sort: false
			};
		}
	}

	/**
	 * Handles the selection of a proposal.
	 * @param isSelected - A boolean indicating whether the proposal is selected.
	 * @param data - The proposal data.
	 */
	selectProposal({ isSelected, data }): void {
		// Update the disableButton property based on the isSelected value
		this.disableButton = !isSelected;

		// Update the selectedProposal property based on the isSelected value
		this.selectedProposal = isSelected ? data : null;
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		const { id: organizationId, tenantId } = this.organization;
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/proposal/pagination`,
			relations: ['organization', 'employee', 'employee.user', 'tags', 'organizationContact'],
			join: {
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId ? { employeeId: this.selectedEmployeeId } : {}),
				valueDate: {
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (proposal: IProposal) => this.proposalMapper(proposal),
			finalize: () => {
				//
				this.calculateStatistics();
				//
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	/**
	 * Calculates and updates statistics related to proposals.
	 */
	private calculateStatistics(): void {
		// Reset the count of accepted proposals
		this.countAccepted = 0;

		// Retrieve the proposals from the smart table source
		const proposals = this.smartTableSource.getData();

		// Count the accepted proposals using Array.reduce
		this.countAccepted = proposals.reduce(
			(count, proposal) => count + (proposal.status === ProposalStatusEnum.ACCEPTED ? 1 : 0),
			0
		);

		// Update the total number of proposals
		this.totalProposals = proposals.length;

		// Calculate the success rate
		this.successRate = this.totalProposals
			? `${((this.countAccepted / this.totalProposals) * 100).toFixed(0)} %`
			: '0 %';
	}

	/**
	 * Maps properties of an IProposal object to a new object with a modified structure.
	 * @param item - The IProposal object to be mapped.
	 * @returns {object} - The mapped object.
	 */
	private proposalMapper = (item: IProposal): object => ({
		id: item.id,
		valueDate: item.valueDate,
		jobPostUrl: item.jobPostUrl,
		jobTitle: item.jobPostContent
			.toString()
			.replace(/<[^>]*(>|$)|&nbsp;/g, '')
			.split(/[\s,\n]+/)
			.slice(0, 3)
			.join(' '),
		jobPostContent: item.jobPostContent,
		proposalContent: item.proposalContent,
		tags: item.tags,
		status: item.status,
		statusBadge: this.statusMapper(item.status),
		author: item.employee,
		organizationContact: item.organizationContact ? item.organizationContact : null
	});

	/**
	 * Retrieves proposals, sets up smart table source, and updates component state.
	 * @returns {Promise<void>} A Promise that resolves when the operation is complete.
	 */
	private async getProposals(): Promise<void> {
		// Check if 'organization' is not defined
		if (!this.organization) {
			return; // If not defined, exit the function
		}

		try {
			// Set up the smart table source
			this.setSmartTableSource();

			// Get current pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging and sorting for the smart table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.smartTableSource.setSort(
				[
					{
						field: 'valueDate',
						direction: 'desc'
					}
				],
				false
			);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				// If the layout style is GRID, initiate GRID view pagination
				await this.smartTableSource.getElements();

				// Update the 'proposals' array with the retrieved data
				this.proposals.push(...this.smartTableSource.getData());

				// Set pagination information based on the smart table source
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			// Handle errors by displaying a danger toastr message
			this.toastrService.danger(error);
		}
	}

	/**
	 * Applies translation updates on the smart table when the language changes.
	 */
	private _applyTranslationOnSmartTable(): void {
		// Subscribe to the onLangChange event from the translateService
		this.translateService.onLangChange
			.pipe(
				// Trigger the _loadSmartTableSettings method when the language changes
				tap(() => this._loadSmartTableSettings()),
				// Unsubscribe when the component is destroyed to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	private clearItem() {
		this.selectProposal({ isSelected: false, data: null });
	}

	ngOnDestroy(): void {}
}
