import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { IPipeline, ComponentLayoutStyleEnum, IOrganization, PipelineTabsEnum } from '@gauzy/contracts';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { Subject, firstValueFrom, BehaviorSubject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	AtLeastOneFieldValidator,
	ErrorHandlingService,
	PipelinesService,
	ServerDataSource,
	ToastrService
} from '@gauzy/ui-sdk/core';
import {
	API_PREFIX,
	ComponentEnum,
	Store,
	distinctUntilChange,
	isNotEmpty,
	isNotNullOrUndefined
} from '@gauzy/ui-sdk/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import { InputFilterComponent } from '../../@shared/table-filters';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { StageComponent } from './stage/stage.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pipelines',
	templateUrl: './pipelines.component.html',
	styleUrls: ['./pipelines.component.scss']
})
export class PipelinesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSettings: object;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public smartTableSource: ServerDataSource;
	public pipelines: IPipeline[] = [];
	public viewComponentName: ComponentEnum;
	public pipeline: IPipeline;
	public organization: IOrganization;
	public name: string;
	public disableButton: boolean = true;
	public loading: boolean = false;
	public pipelineTabsEnum = PipelineTabsEnum;
	public pipelines$: Subject<any> = this.subject$;
	public nbTab$: Subject<string> = new BehaviorSubject(PipelineTabsEnum.ACTIONS);
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Search Tab Form
	 */
	public searchForm: UntypedFormGroup = PipelinesComponent.searchBuildForm(this.fb);
	static searchBuildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group(
			{
				name: [],
				stages: [],
				status: []
			},
			{
				validators: [AtLeastOneFieldValidator]
			}
		);
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly pipelinesService: PipelinesService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly httpClient: HttpClient,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly router: Router,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		// Subscribe to changes in the pipelines$ observable stream
		this.pipelines$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Perform the 'clearItem' action when the observable emits a value
				tap(() => this.clearItem()),
				// Perform the 'getPipelines' action when the observable emits a value
				tap(() => this.getPipelines()),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the nbTab$ observable stream
		this.nbTab$
			.pipe(
				// Ensure distinct values are emitted
				distinctUntilChange(),
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Filter the observable based on a condition
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				// Perform the 'next' action on _refresh$ and pipelines$ observables
				tap(() => this._refresh$.next(true)),
				tap(() => this.pipelines$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the pagination$ observable stream
		this.pagination$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure distinct values are emitted
				distinctUntilChange(),
				// Perform the 'next' action on the pipelines$ observable
				tap(() => this.pipelines$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the selectedOrganization$ observable stream
		this.store.selectedOrganization$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Filter out falsy values and ensure organization is truthy
				filter((organization: IOrganization) => !!organization),
				// Ensure distinct values are emitted
				distinctUntilChange(),
				// Perform the 'tap' action to assign the organization to the component property
				tap((organization: IOrganization) => (this.organization = organization)),
				// Perform additional actions: trigger _refresh$ and pipelines$ observables
				tap(() => this._refresh$.next(true)),
				tap(() => this.pipelines$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the _refresh$ observable stream
		this._refresh$
			.pipe(
				// Filter out values when dataLayoutStyle is not CARDS_GRID
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				// Perform the 'tap' action to refresh pagination
				tap(() => this.refreshPagination()),
				// Perform the 'tap' action to clear the pipelines array
				tap(() => (this.pipelines = [])),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the query parameters
		this.route.queryParamMap
			.pipe(
				// Only proceed if query parameters are present and 'openAddDialog' is 'true'
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				// Wait for 1000 milliseconds of inactivity
				debounceTime(1000),
				// Trigger the createPipeline method
				tap(() => this.createPipeline()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets up the initial view configuration and subscribes to changes in the component layout.
	 */
	setView() {
		// Set the default view component name to PROPOSALS
		this.viewComponentName = ComponentEnum.PROPOSALS;

		// Subscribe to changes in the component layout
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
				// Only proceed if the component layout is CARDS_GRID
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				// Clear the pipelines array
				tap(() => (this.pipelines = [])),
				// Trigger the pipelines$ observable
				tap(() => this.pipelines$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads and configures the settings for the Smart Table used in the context of pipelines.
	 */
	private _loadSmartTableSettings() {
		// Get pagination settings
		const pagination: IPaginationBase = this.getPagination();

		// Configure Smart Table settings
		this.smartTableSettings = {
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PIPELINE'),
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
					renderComponent: StageComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				},
				status: {
					filter: false,
					editor: false,
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				}
			}
		};
	}

	/**
	 * Applies translations to the Smart Table.
	 */
	private _applyTranslationOnSmartTable() {
		// Subscribe to language change events using the translateService
		this.translateService.onLangChange
			.pipe(
				// When a language change is detected, execute the following actions
				tap(() => {
					// Load or reload the Smart Table settings to reflect language changes
					this._loadSmartTableSettings();
				}),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			// Subscribe to the observable
			.subscribe();
	}

	/**
	 * Registers the Smart Table source configuration for pipelines.
	 */
	setSmartTableSource(): void {
		// Check if the organization is defined
		if (!this.organization) {
			return;
		}

		// Set loading to true while fetching data
		this.loading = true;

		// Extract organization and tenant information
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		// Create a new ServerDataSource for pipelines
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/pipelines/pagination`,
			relations: ['stages'],
			join: {
				alias: 'pipeline',
				leftJoin: {
					stages: 'pipeline.stages'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				organizationId,
				tenantId,
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (pipeline: IPipeline) => {
				// Map the pipeline and include the status using the statusMapper
				return Object.assign({}, pipeline, {
					status: this.statusMapper(pipeline.isActive)
				});
			},
			finalize: () => {
				// If the data layout style is CARDS_GRID, push data to pipelines array
				if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
					this.pipelines.push(...this.smartTableSource.getData());
				}

				// Set pagination with the total count from the Smart Table source
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});

				// Set loading to false as data fetching is complete
				this.loading = false;
			}
		});
	}

	/**
	 * Maps the status value to an object with text and class properties.
	 * @param value - The status value to be mapped.
	 * @returns An object with text and class properties.
	 */
	private statusMapper = (value: string | boolean) => {
		// Determine the badge class based on the status value
		const badgeClass = value ? 'success' : 'warning';

		// Map the status value to a translated text
		const statusText = value
			? this.getTranslation('PIPELINES_PAGE.ACTIVE')
			: this.getTranslation('PIPELINES_PAGE.INACTIVE');

		// Return an object with text and class properties
		return {
			text: statusText,
			class: badgeClass
		};
	};

	/**
	 * Fetches and sets up the pipelines data for the Smart Table.
	 * Handles pagination based on the current layout style.
	 */
	async getPipelines() {
		// Check if organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Set up the Smart Table source configuration
			this.setSmartTableSource();

			// Get pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the Smart Table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// If the layout style is CARDS_GRID, initiate GRID view pagination
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			// Handle errors using the error handling service
			this.errorHandlingService.handleError(error);
		}
	}

	/**
	 * Deletes a pipeline after user confirmation.
	 * @param selectedItem - The pipeline item to be deleted.
	 */
	async deletePipeline(selectedItem?: IPipeline): Promise<void> {
		// If a pipeline item is provided, select it
		if (selectedItem) {
			this.selectPipeline({
				isSelected: true,
				data: selectedItem
			});
		}

		try {
			// Open a confirmation dialog and wait for the result
			const confirmationResult: 'ok' = await firstValueFrom(
				this.dialogService.open(DeleteConfirmationComponent, {
					context: {
						recordType: this.getTranslation('PIPELINES_PAGE.RECORD_TYPE', this.pipeline)
					}
				}).onClose
			);

			// If the user confirms, proceed with deletion
			if ('ok' === confirmationResult) {
				// Delete the selected pipeline
				await this.pipelinesService.delete(this.pipeline.id);

				// Display a success message
				this.toastrService.success('TOASTR.MESSAGE.PIPELINE_DELETED', {
					name: this.pipeline.name
				});

				// Trigger a refresh for the component and pipelines
				this._refresh$.next(true);
				this.pipelines$.next(true);
			}
		} catch (error) {
			// Handle errors using the error handling service
			this.errorHandlingService.handleError(error);
		}
	}

	/**
	 * Creates a new pipeline after user input.
	 */
	async createPipeline(): Promise<void> {
		// Ensure there is a selected organization
		if (!this.organization) {
			return;
		}

		try {
			// Destructure properties needed for creating a pipeline
			const { name } = this;
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			// Perform the pipeline creation and navigate to the new pipeline
			await this.goto({ pipeline: { name, organizationId, tenantId } });

			// Clear the input field after successful pipeline creation
			delete this.name;
		} catch (error) {
			// Handle errors using the error handling service
			this.errorHandlingService.handleError(error);
		}
	}

	/**
	 * Edits the details of a selected pipeline after user input.
	 * @param selectedItem - The pipeline to be edited.
	 */
	async editPipeline(selectedItem?: IPipeline): Promise<void> {
		// If a pipeline is selected, update the selected pipeline
		if (selectedItem) {
			this.selectPipeline({
				isSelected: true,
				data: selectedItem
			});
		}

		try {
			// Ensure there is a selected organization
			if (!this.organization) {
				return;
			}

			// Destructure properties needed for editing a pipeline
			const { name } = this;
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			// If there is a selected pipeline, update its details
			if (this.pipeline) {
				const { id: pipelineId } = this.pipeline;

				// Perform the pipeline update and navigate to the updated pipeline
				await this.goto({ pipeline: { id: pipelineId, name, organizationId, tenantId } });

				// Clear the input field after successful pipeline update
				delete this.name;
			}
		} catch (error) {
			// Handle errors using the error handling service
			this.errorHandlingService.handleError(error);
		}
	}

	/**
	 * Navigates to the PipelineFormComponent to create or update a pipeline based on the provided context.
	 * @param context - The context containing pipeline details.
	 */
	private async goto(context: Record<any, any>): Promise<void> {
		try {
			// Open the PipelineFormComponent with the provided context
			const dialogRef = this.dialogService.open(PipelineFormComponent, { context });

			// Wait for the dialog to close and get the result
			const data = await firstValueFrom(dialogRef.onClose);

			// Extract pipeline details from the context
			const {
				pipeline: { id, name }
			} = context;

			// If data is received, display a success message and trigger refresh
			if (data) {
				const successMessage = id ? `TOASTR.MESSAGE.PIPELINE_UPDATED` : `TOASTR.MESSAGE.PIPELINE_CREATED`;

				this.toastrService.success(successMessage, {
					name: id ? name : data.name
				});
			}
		} catch (error) {
			// Handle errors using the error handling service
			this.errorHandlingService.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.pipelines$.next(true);
		}
	}

	/**
	 * Navigates to the "Deals" page for the selected pipeline.
	 * @param selectedItem - The selected pipeline.
	 */
	viewDeals(selectedItem?: IPipeline): void {
		try {
			// If a pipeline is selected, update the selected pipeline
			if (selectedItem) {
				this.selectPipeline({
					isSelected: true,
					data: selectedItem
				});
			}

			// Ensure there is a valid pipeline before navigating
			if (this.pipeline) {
				// Construct the route for navigating to the "Deals" page
				const dealsPageRoute = `/pages/sales/pipelines/${this.pipeline.id}/deals`;

				// Navigate to the "Deals" page
				this.router.navigate([dealsPageRoute]);
			} else {
				// Handle the case where there is no selected pipeline
				throw new Error('No pipeline selected.');
			}
		} catch (error) {
			// Handle errors using the error handling service
			this.errorHandlingService.handleError(error);
		}
	}

	/**
	 * Updates the state when a pipeline is selected or deselected.
	 * @param param0 - Object containing information about the selection (isSelected, data).
	 */
	selectPipeline({ isSelected, data }): void {
		// Update the disableButton property based on the isSelected value
		this.disableButton = !isSelected;

		// Update the pipeline property based on the isSelected value
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
	}

	/**
	 * Handles the change event when a tab is selected.
	 * @param tab - The selected tab.
	 */
	onChangeTab(tab: NbTabComponent): void {
		// Update the nbTab$ observable with the ID of the currently selected tab
		this.nbTab$.next(tab.tabId);
	}

	/**
	 * Handles the search functionality based on the values from the search form.
	 */
	search(): void {
		// Destructure values from the searchForm
		const { status, name, stages } = this.searchForm.getRawValue();

		// Set filters based on the extracted values
		if (isNotNullOrUndefined(status)) {
			this.setFilter({ field: 'isActive', search: status }, false);
		}
		if (isNotNullOrUndefined(name)) {
			this.setFilter({ field: 'name', search: name }, false);
		}
		if (isNotNullOrUndefined(stages)) {
			this.setFilter({ field: 'stages', search: stages }, false);
		}

		// Check if there are filters set
		if (isNotEmpty(this.filters)) {
			// Refresh pagination, update data, and trigger a refresh of the pipelines
			this.refreshPagination();
			this._refresh$.next(true);
			this.pipelines$.next(true);
		}
	}

	/**
	 * Resets the search form, clears filters, and triggers a refresh of the pipelines.
	 */
	reset(): void {
		// Reset the search form to its initial state
		this.searchForm.reset();

		// Clear the filters
		this._filters = {};

		// Trigger a refresh of the data related to pipelines
		this._refresh$.next(true);
		this.pipelines$.next(true);
	}

	ngOnDestroy(): void {}
}
