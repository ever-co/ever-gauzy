import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import {
	IEventType,
	ComponentLayoutStyleEnum,
	IOrganization,
	IEventTypeViewModel
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ErrorHandlingService,
	EventTypeService,
	Store,
	ToastrService
} from '../../../@core/services';
import { PaginationFilterBaseComponent } from '../../../@shared/pagination/pagination-filter-base.component';
import { EventTypeMutationComponent } from './event-type-mutation/event-type-mutation.component';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms';
import { NotesWithTagsComponent } from '../../../@shared/table-components';
import { API_PREFIX, ComponentEnum } from '../../../@core/constants';
import { DEFAULT_EVENT_TYPE } from './default-event-type';
import { ServerDataSource } from '../../../@core/utils/smart-table/server.data-source';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './event-type.component.html',
	styleUrls: ['event-type.component.scss']
})
export class EventTypeComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {
		
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
	
	eventTypesTable: Ng2SmartTableComponent;
	@ViewChild('eventTypesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.eventTypesTable = content;
			this._onChangedSource();
		}
	}

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
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getEventTypes()),
				tap(() => this._clearItem()),
				tap(() => this.loading = false),
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
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
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
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				tap(() => this.eventTypes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	openAddEventTypeDialog() {
		this.dialogService
			.open(EventTypeMutationComponent)
			.onClose
			.pipe(untilDestroyed(this))
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
			.onClose
			.pipe(untilDestroyed(this))
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
						}

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
					recordType: this.getTranslation(
						'FORM.DELETE_CONFIRMATION.EVENT_TYPE'
					)
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { title } = this.selectedEventType;
						await this.eventTypeService.delete(
							this.selectedEventType.id
						)
						.then(() => {
							this.toastrService.success('NOTES.EVENT_TYPES.DELETE_EVENT_TYPE', {
								name: title
							});
						})
						.finally(() => {
							this.eventTypes$.next(true);
						});
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
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

	/*
	 * Table on changed source event
	 */
	private _onChangedSource() {
		this.eventTypesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._clearItem())
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		this.smartTableSettings = {
			actions: false,
			columns: {
				title: {
					title: this.getTranslation('EVENT_TYPE_PAGE.EVENT_NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				},
				durationFormat: {
					title: this.getTranslation(
						'EVENT_TYPE_PAGE.EVENT_DURATION'
					),
					type: 'text',
					class: 'align-row'
				},
				description: {
					title: this.getTranslation(
						'EVENT_TYPE_PAGE.EVENT_DESCRIPTION'
					),
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
					filter: false,
					sort: false
				}
			},
			pager: {
				display: true,
				perPage: 10
			}
		};
	}

	/**
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.selectedEmployeeId) {
			request['employeeId'] = this.selectedEmployeeId;
		}

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/event-type/pagination`,
			relations: [
				'employee',
				'employee.user',
				'tags'
			],
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (i: IEventType) => {
				const durationFormat = `${i.duration} ${i.durationUnit}`;
				const employeeName = i.employee.fullName;

				return Object.assign({}, i, {
					active: i.isActive
						? this.getTranslation('EVENT_TYPE_PAGE.YES')
						: this.getTranslation('EVENT_TYPE_PAGE.NO'),
					durationFormat,
					employeeName
				});
			},
			finalize: () => {
				this.loading = false;
				this.localDataSource.load(this.mapEventTypes());
			}
		});
	}

	/**
	 * GET all event types
	 */
	private async getEventTypes() {
		try { 
			this.setSmartTableSource();

			// Initiate GRID view pagination
			const { activePage, itemsPerPage } = this.pagination;
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			await this.smartTableSource.getElements();
			this.eventTypes = this.mapEventTypes();

			this.pagination['totalItems'] =  this.smartTableSource.count();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * Map default types & organization event types
	 * 
	 * @returns 
	 */
	private mapEventTypes() {
		const data = this.smartTableSource.getData() || [];
		return data.concat(
			this.defaultEventTypes.filter(
				(e) => !data.find((i) => i.durationFormat === e.durationFormat)
			)
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
		this.deselectAll();
	}

	/**
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.eventTypesTable && this.eventTypesTable.grid) {
			this.eventTypesTable.grid.dataSet['willSelect'] = 'false';
			this.eventTypesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy(): void {}
}
