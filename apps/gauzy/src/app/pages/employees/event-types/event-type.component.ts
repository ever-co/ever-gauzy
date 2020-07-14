import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { IEventType, Tag, ComponentLayoutStyleEnum } from '@gauzy/models';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { EventTypeMutationComponent } from './event-type-mutation/event-type-mutation.component';
import { EventTypeService } from '../../../@core/services/event-type.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { NotesWithTagsComponent } from '../../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { ComponentEnum } from '../../../@core/constants/layout.constants';

export interface EventTypeViewModel {
	title: string;
	description: string;
	durationFormat: string;
	id: string;
	Active: string;
	isActive: boolean;
	duration: Number;
	durationUnit: string;
	tags: Tag[];
}
@Component({
	templateUrl: './event-type.component.html',
	styleUrls: ['event-type.component.scss']
})
export class EventTypeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedEventType: EventTypeViewModel;
	eventTypeData;
	showTable: boolean;
	selectedEmployeeId: string;
	employeeName: string;
	_selectedOrganizationId: string;
	tags?: Tag[];
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	@ViewChild('eventTypesTable') eventTypesTable;

	loading = true;
	defaultEventTypes: EventTypeViewModel[] = [
		{
			id: null,
			title: '15 Minutes Event',
			description: 'This is a default event type.',
			duration: 15,
			durationUnit: 'Minute(s)',
			isActive: false,
			Active: 'No',
			durationFormat: '15 Minute(s)',
			tags: []
		},
		{
			id: null,
			title: '30 Minutes Event',
			description: 'This is a default event type.',
			duration: 30,
			durationUnit: 'Minute(s)',
			isActive: false,
			Active: 'No',
			durationFormat: '30 Minute(s)',
			tags: []
		},
		{
			id: null,
			title: '60 Minutes Event',
			description: 'This is a default event type.',
			duration: 60,
			durationUnit: 'Minute(s)',
			isActive: false,
			Active: 'No',
			durationFormat: '60 Minute(s)',
			tags: []
		}
	];

	constructor(
		private route: ActivatedRoute,
		private store: Store,
		private errorHandler: ErrorHandlingService,
		private eventTypeService: EventTypeService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData(null, this._selectedOrganizationId);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					if (this.loading) {
						this._loadTableData(
							this.store.selectedEmployee
								? this.store.selectedEmployee.id
								: null,
							this.store.selectedEmployee &&
								this.store.selectedEmployee.id
								? null
								: this._selectedOrganizationId
						);
					}
				}
			});

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.openAddEventTypeDialog();
				}
			});

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.openAddEventTypeDialog();
				}
			});

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});

		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	setView() {
		this.viewComponentName = ComponentEnum.EVENT_TYPES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	private async _loadTableData(
		employeeId = this.selectedEmployeeId,
		organizationId?: string
	) {
		let findObj;
		this.showTable = false;
		this.selectedEventType = null;

		if (organizationId) {
			findObj = {
				organizationId
			};

			this.settingsSmartTable['columns']['employee'] = {
				title: 'Employee',
				type: 'string',
				valuePrepareFunction: (_, eventType: IEventType) => {
					const user = eventType.employee
						? eventType.employee.user
						: null;

					if (user) {
						return `${user.firstName} ${user.lastName}`;
					}
				}
			};
		} else {
			findObj = {
				employee: {
					id: employeeId
				}
			};

			delete this.settingsSmartTable['columns']['employee'];
		}

		try {
			const { items } = await this.eventTypeService.getAll(
				['employee', 'employee.user', 'tags'],
				findObj
			);
			let eventTypeVM: EventTypeViewModel[] = items.map((i) => ({
				isActive: i.isActive,
				Active: i.isActive ? 'Yes' : 'No',
				description: i.description,
				durationFormat: `${i.duration} ${i.durationUnit}`,
				title: i.title,
				id: i.id,
				duration: i.duration,
				durationUnit: i.durationUnit,
				employee: i.employee,
				tags: i.tags
			}));

			eventTypeVM = eventTypeVM.concat(
				this.defaultEventTypes.filter(
					(e) =>
						!eventTypeVM.find(
							(i) => i.durationFormat === e.durationFormat
						)
				)
			);
			this.eventTypeData = eventTypeVM;
			this.sourceSmartTable.load(eventTypeVM);
			this.showTable = true;
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.EVENT_TYPES.ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
		this.employeeName = this.store.selectedEmployee
			? (
					this.store.selectedEmployee.firstName +
					' ' +
					this.store.selectedEmployee.lastName
			  ).trim()
			: 'All Employees';
		this.loading = false;
	}

	getFormData(formData) {
		return {
			title: formData.title,
			description: formData.description,
			duration: formData.duration,
			durationUnit: formData.durationUnit,
			employee: formData.employee,
			isActive: formData.isActive,
			tags: this.tags
		};
	}

	openAddEventTypeDialog() {
		this.dialogService
			.open(EventTypeMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				if (formData) {
					await this.addEventType(
						this.getFormData(formData),
						formData
					);
				}
			});
	}

	async addEventType(completedForm: any, formData: any) {
		completedForm.tags = formData.tags;
		try {
			await this.eventTypeService.create({
				...completedForm,
				employeeId: formData.employee ? formData.employee.id : null,
				organizationId: this.store.selectedOrganization.id
			});

			this.toastrService.primary(
				this.getTranslation('NOTES.EVENT_TYPES.ADD_EVENT_TYPE', {
					name: formData.employee
						? `${formData.employee.firstName} ${formData.employee.lastName}`
						: this.getTranslation('SM_TABLE.EMPLOYEE')
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.store.selectedEmployee = formData.employee
				? formData.employee
				: null;
			this._loadTableData(
				this.selectedEmployeeId,
				this.selectedEmployeeId ? null : this._selectedOrganizationId
			);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	canShowTable() {
		if (this.eventTypesTable) {
			this.eventTypesTable.grid.dataSet.willSelect = 'false';
		}
		return this.showTable;
	}

	openEditEventTypeDialog(selectedItem?: EventTypeViewModel) {
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				try {
					if (formData) {
						const completedForm = this.getFormData(formData);

						// For default event types
						if (formData.id === null) {
							await this.eventTypeService.create({
								...completedForm,
								employeeId: formData.employee
									? formData.employee.id
									: null,
								organizationId: this.store.selectedOrganization
									.id
							});
						} else {
							await this.eventTypeService.update(formData.id, {
								...completedForm,
								employeeId: formData.employee
									? formData.employee.id
									: null,
								tags: formData.tags
							});
						}
						this.toastrService.primary(
							this.getTranslation(
								'NOTES.EVENT_TYPES.EDIT_EVENT_TYPE',
								{
									name: this.employeeName
								}
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);

						this._loadTableData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
					}
				} catch (error) {
					this.errorHandler.handleError(error);
				}
			});
	}

	selectEventType({ isSelected, data }) {
		const selectedEventType = isSelected ? data : null;
		if (this.eventTypesTable) {
			this.eventTypesTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedEventType = selectedEventType;
	}

	async deleteEventType(selectedItem?: EventTypeViewModel) {
		if (selectedItem) {
			this.selectEventType({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'FORM.DELETE_CONFIRMATION.EVENT_TYPE'
					)
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.eventTypeService.delete(
							this.selectedEventType.id
						);

						this.toastrService.primary(
							this.getTranslation(
								'NOTES.EVENT_TYPES.DELETE_EVENT_TYPE',
								{
									name: this.employeeName
								}
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadTableData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
						this.selectedEventType = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSmartTableSettings();
			});
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
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
				Active: {
					title: this.getTranslation('EVENT_TYPE_PAGE.ACTIVE'),
					type: 'text',
					class: 'align-row'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	ngOnDestroy() {
		delete this.settingsSmartTable['columns']['employee'];
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
