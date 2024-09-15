import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IEventType,
	ComponentLayoutStyleEnum,
	IOrganization,
	IEventTypeViewModel,
	PermissionsEnum
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { ErrorHandlingService, EventTypeService, ServerDataSource, Store, ToastrService } from '@gauzy/ui-core/core';
import {
	PaginationFilterBaseComponent,
	IPaginationBase,
	NotesWithTagsComponent,
	DeleteConfirmationComponent
} from '@gauzy/ui-core/shared';
import { EventTypeMutationComponent } from './event-type-mutation/event-type-mutation.component';
import { DEFAULT_EVENT_TYPE } from './default-event-type';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './event-type.component.html',
	styleUrls: ['event-type.component.scss']
})
export class EventTypeComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	smartTableSource: ServerDataSource;
	smartTableSettings: object;
	localDataSource = new LocalDataSource();
	selectedEventType: IEventTypeViewModel;
	eventTypes: IEventTypeViewModel[] = [];
	selectedEmployeeId: string;
	viewComponentName: ComponentEnum;
	disableButton: boolean = true;
	loading: boolean;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	eventTypes$: Subject<any> = new Subject();

	defaultEventTypes: IEventTypeViewModel[] = DEFAULT_EVENT_TYPE;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly errorHandler: ErrorHandlingService,
		private readonly eventTypeService: EventTypeService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();

		this.eventTypes$
			.pipe(
				tap(() => this._clearItem()),
				tap(() => this.getEventTypes()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.eventTypes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
					this.eventTypes$.next(true);
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.eventTypes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.openAddEventTypeDialog()),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.eventTypes = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		if (this.store.user && !this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			delete this.smartTableSettings['columns']['employeeName'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.EVENT_TYPES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.eventTypes = [])),
				tap(() => this.eventTypes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	openAddEventTypeDialog() {
		this.dialogService
			.open(EventTypeMutationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					await this.addEventType(data);
				}
			});
	}

	async addEventType(data: any) {
		try {
			const { title, employeeId } = data;
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			await this.eventTypeService.create({
				...data,
				employeeId,
				organizationId,
				tenantId
			});

			this.toastrService.success('NOTES.EVENT_TYPES.ADD_EVENT_TYPE', {
				name: title
			});
			this._refresh$.next(true);
			this.eventTypes$.next(true);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	openEditEventTypeDialog(selectedItem?: IEventTypeViewModel) {
		if (selectedItem) {
			this.selectEventType({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(EventTypeMutationComponent, {
				context: {
					eventType: this.selectedEventType
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				try {
					if (data) {
						const { id, title, employeeId } = data;
						const { tenantId } = this.store.user;
						const { id: organizationId } = this.organization;

						const request = {
							...data,
							employeeId,
							organizationId,
							tenantId
						};

						// For default event types
						if (isEmpty(id)) {
							await this.eventTypeService.create(request);
						} else {
							await this.eventTypeService.update(id, request);
						}
						this.toastrService.success('NOTES.EVENT_TYPES.EDIT_EVENT_TYPE', {
							name: title
						});
					}
				} catch (error) {
					this.errorHandler.handleError(error);
				} finally {
					this._refresh$.next(true);
					this.eventTypes$.next(true);
				}
			});
	}

	selectEventType({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedEventType = isSelected ? data : null;
	}

	async deleteEventType(selectedItem?: IEventTypeViewModel) {
		if (selectedItem) {
			this.selectEventType({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedEventType) {
			return;
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('FORM.DELETE_CONFIRMATION.EVENT_TYPE')
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { title } = this.selectedEventType;
						await this.eventTypeService
							.delete(this.selectedEventType.id)
							.then(() => {
								this.toastrService.success('NOTES.EVENT_TYPES.DELETE_EVENT_TYPE', {
									name: title
								});
							})
							.finally(() => {
								this._refresh$.next(true);
								this.eventTypes$.next(true);
							});
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this._refresh$.next(true);
						this.eventTypes$.next(true);
					}
				}
			});
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EVENT_TYPE'),
			columns: {
				title: {
					title: this.getTranslation('EVENT_TYPE_PAGE.EVENT_NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent,
					componentInitFunction: (instance: NotesWithTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				durationFormat: {
					title: this.getTranslation('EVENT_TYPE_PAGE.EVENT_DURATION'),
					type: 'text',
					class: 'align-row'
				},
				description: {
					title: this.getTranslation('EVENT_TYPE_PAGE.EVENT_DESCRIPTION'),
					type: 'text',
					class: 'align-row'
				},
				active: {
					title: this.getTranslation('EVENT_TYPE_PAGE.ACTIVE'),
					type: 'text',
					class: 'align-row'
				},
				employeeName: {
					title: this.getTranslation('EVENT_TYPE_PAGE.EMPLOYEE'),
					type: 'string',
					isFilterable: false,
					sort: false
				}
			},
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			}
		};
	}

	/**
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
			endPoint: `${API_PREFIX}/event-type/pagination`,
			relations: ['employee', 'employee.user', 'tags'],
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId
					? {
							employeeId: this.selectedEmployeeId
					  }
					: {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (i: IEventType) => {
				const durationFormat = `${i.duration} ${i.durationUnit}`;
				const employeeName = i.employee ? i.employee.fullName : 'default';

				return Object.assign({}, i, {
					active: i.isActive
						? this.getTranslation('EVENT_TYPE_PAGE.YES')
						: this.getTranslation('EVENT_TYPE_PAGE.NO'),
					durationFormat,
					employeeName
				});
			},
			finalize: () => {
				this.localDataSource.load(this.mapEventTypes());
				this.setPagination({
					...this.pagination,
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	/**
	 * GET all event types
	 */
	private async getEventTypes() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this._isGridLayout) {
				// Initiate GRID view pagination
				await this.smartTableSource.getElements();
				const data = this.mapEventTypes();
				this.eventTypes.push(...data);
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID;
	}
	/**
	 * Map default types & organization event types
	 *
	 * @returns
	 */
	private mapEventTypes() {
		const data = this.smartTableSource.getData() || [];
		return data.concat(
			this.defaultEventTypes.filter((e) => !data.find((i) => i.durationFormat === e.durationFormat))
		);
	}

	/*
	 * Clear selected item
	 */
	private _clearItem() {
		this.selectEventType({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy(): void {}
}
