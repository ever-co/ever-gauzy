import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { tap } from 'rxjs/operators';
import { debounceTime, filter, firstValueFrom, Subject } from 'rxjs';
import { GoalSettingsService } from '../../@core/services/goal-settings.service';
import { AlertModalComponent } from '../../@shared/alert-modal/alert-modal.component';
import { Store } from '../../@core/services/store.service';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import {
	ComponentLayoutStyleEnum,
	GoalOwnershipEnum,
	IGoalGeneralSetting,
	IOrganization
} from '@gauzy/contracts';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { FormGroup, FormBuilder } from '@angular/forms';
import { GoalTemplatesComponent } from '../../@shared/goal/goal-templates/goal-templates.component';
import { ValueWithUnitComponent } from '../../@shared/table-components/value-with-units/value-with-units.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { distinctUntilChange } from '@gauzy/common-angular';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html',
	styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
	smartTableData = new LocalDataSource();
	generalSettingsForm: FormGroup;
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	selectedKPI: any = null;
	selectedTab: string;
	selectedOrganizationId: string;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	disableButton = true;
	goalTimeFrames: any[];
	goalGeneralSettings: IGoalGeneralSetting;
	goalOwnershipEnum = GoalOwnershipEnum;
	predefinedTimeFrames = [];
	loading: boolean;
	private _goalSettings$: Subject<any> = this.subject$;

	goalSettingsTable: Ng2SmartTableComponent;
	@ViewChild('goalSettingsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.goalSettingsTable = content;
			this.onChangedSource();
		}
	}
	organization: IOrganization;
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService,
		private toastrService: ToastrService,
		private store: Store,
		private router: Router,
		private fb: FormBuilder
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.generalSettingsForm = this.fb.group({
			maxObjectives: [],
			maxKeyResults: [],
			employeeCanCreateObjective: [true],
			canOwnObjectives: [],
			canOwnKeyResult: [],
			krTypeKPI: [true],
			krTypeTask: [true]
		});
		this._loadTableSettings(null);
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe(async (organization) => {
				if (organization) {
					this.organization = organization;
					this.selectedOrganizationId = organization.id;
					if (this.selectedTab) {
						await this._loadTableData(this.selectedTab);
					}
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this._goalSettings$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._goalSettings$
			.pipe(
				debounceTime(100),
				filter(() => !!this.selectedTab),
				tap(async () => await this._loadTableData(this.selectedTab)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.GOAL_SETTINGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				tap(() => this.refreshPagination()),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this._goalSettings$.next(true)),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.selectedKPI = null;
				this.selectedTimeFrame = null;
			});
	}

	async saveGeneralSettings() {
		await this.goalSettingService
			.updateGeneralSettings(
				this.goalGeneralSettings.id,
				this.generalSettingsForm.value
			)
			.then((res) => {
				if (res) {
					this.toastrService.success(
						'TOASTR.MESSAGE.GOAL_GENERAL_SETTING_UPDATED'
					);
					this._loadTableData(null);
				}
			});
	}

	tabChange(e) {
		this.selectedTab = e.tabId;
		this._loadTableSettings(e.tabId);
		this._loadTableData(e.tabId);
		this.refreshPagination();
		this.smartTableData.empty();
		this.goalTimeFrames = [];
		if (this.goalSettingsTable) {
			this.selectedKPI = null;
			this.selectedTimeFrame = null;
		}
	}

	selectRow({ isSelected, data }) {
		this.selectedKPI = null;
		this.selectedTimeFrame = null;
		if (isSelected) {
			if (this.selectedTab === 'kpi') {
				this.selectedKPI = data;
			} else if (this.selectedTab === 'timeframe') {
				this.selectedTimeFrame = data;
			}
		}
		this.disableButton = !isSelected;
	}

	private async _loadTableData(tab) {
		this.loading = true;
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const findObj = {
			organization: {
				id: organizationId
			},
			tenantId
		};
		const { activePage, itemsPerPage } = this.getPagination();
		this.smartTableData.setPaging(activePage, itemsPerPage, false);

		if (tab === 'kpi') {
			await this.goalSettingService.getAllKPI(findObj).then((res) => {
				this.smartTableData.load(res.items);
			});
		} else if (tab === 'timeframe') {
			await this.goalSettingService
				.getAllTimeFrames(findObj)
				.then((res) => {
					if (!!res) {
						const mappedItems = [];
						res.items.map((item) => {
							item = Object.assign({}, item, {
								status: this.statusMapper(item.status)
							});
							mappedItems.push(item);
						});
						this.smartTableData.load(mappedItems);
					}
				});
		} else {
			await this.goalSettingService
				.getAllGeneralSettings(findObj)
				.then((generalSettings) => {
					const { items } = generalSettings;
					this.goalGeneralSettings = items.pop();
					this.generalSettingsForm.patchValue({
						...this.goalGeneralSettings
					});
				});
		}
		this._loadGridLayoutData();
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableData.count()
		});
		this.loading = false;
	}

	private async _loadGridLayoutData() {
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
			this.goalTimeFrames = await this.smartTableData.getElements();
		}
	}

	private _loadTableSettings(tab: string | null) {
		this.smartTableSettings = {
			actions: false,
			hideSubHeader: true,
			pager: {
				display: false
			}
		};
		if (tab === 'kpi') {
			this.smartTableSettings = {
				...this.smartTableSettings,
				noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.KPI'),
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string'
					},
					currentValue: {
						title: this.getTranslation('SM_TABLE.CURRENT_VALUE'),
						type: 'custom',
						filter: false,
						renderComponent: ValueWithUnitComponent
					},
					targetValue: {
						title: this.getTranslation('SM_TABLE.TARGET_VALUE'),
						type: 'custom',
						filter: false,
						renderComponent: ValueWithUnitComponent
					},
					updatedAt: {
						title: this.getTranslation('SM_TABLE.LAST_UPDATED'),
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent
					}
				}
			};
		} else if (tab === 'timeframe') {
			this.smartTableSettings = {
				...this.smartTableSettings,
				noDataMessage: this.getTranslation(
					'SM_TABLE.NO_DATA.TIME_FRAME'
				),
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string',
						width: '50%'
					},
					startDate: {
						title: this.getTranslation('SM_TABLE.START_DATE'),
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent
					},
					endDate: {
						title: this.getTranslation('SM_TABLE.END_DATE'),
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent
					},
					status: {
						title: this.getTranslation('SM_TABLE.STATUS'),
						type: 'custom',
						width: '5%',
						filter: false,
						renderComponent: StatusBadgeComponent
					}
				}
			};
		}
	}

	async editTimeFrame(source, selectedItem?: any) {
		const prdefTimeFrames = this.predefinedTimeFrames.filter(
			(timeFrame) => {
				return (
					this.goalTimeFrames.findIndex(
						(goalTimeFrame) => goalTimeFrame.name === timeFrame.name
					) === -1
				);
			}
		);
		if (source === 'add') {
			this.selectedTimeFrame = null;
		} else {
			if (selectedItem) {
				this.selectRow({
					isSelected: true,
					data: selectedItem
				});
			}
		}
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				timeFrame: this.selectedTimeFrame,
				type: source,
				predefinedTimeFrames: prdefTimeFrames
			},
			closeOnBackdropClick: false
		});

		const response = await firstValueFrom(dialog.onClose);
		this.clearItem();
		if (!!response) {
			this._loadTableSettings('timeframe');
			await this._loadTableData('timeframe');
		}
	}

	async editKPI(source, selectedItem?: any) {
		if (source === 'add') {
			this.selectedKPI = null;
		} else {
			if (selectedItem) {
				this.selectRow({
					isSelected: true,
					data: selectedItem
				});
			}
		}
		const kpiDialog = this.dialogService.open(EditKpiComponent, {
			context: {
				selectedKPI: this.selectedKPI,
				type: source
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(kpiDialog.onClose);
		this.clearItem();
		if (!!response) {
			this._loadTableSettings('kpi');
			await this._loadTableData('kpi');
		}
	}

	async deleteTimeFrame(selectedItem?: any) {
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_TIME_FRAME_TITLE'
					),
					message: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_TIME_FRAME_CONFIRMATION'
					),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteTimeFrame(this.selectedTimeFrame.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.success(
								'TOASTR.MESSAGE.TIME_FRAME_DELETED',
								{ name: this.selectedTimeFrame.name }
							);
							this.clearItem();
							this._loadTableSettings('timeframe');
							await this._loadTableData('timeframe');
						}
					});
			}
		}
	}

	async deleteKPI(selectedItem?: any) {
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_KPI_TITLE'
					),
					message: this.translateService.instant(
						'GOALS_PAGE.SETTINGS.DELETE_KPI_CONFIRMATION'
					),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteKPI(this.selectedKPI.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.success(
								'TOASTR.MESSAGE.KPI_DELETED'
							);
							this.clearItem();
							this._loadTableSettings('kpi');
							await this._loadTableData('kpi');
						}
					});
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this._loadTableSettings(null);
			});
	}

	ngOnDestroy() {}

	async addTemplate() {
		const goalTemplateDialog = this.dialogService.open(
			GoalTemplatesComponent
		);
		await firstValueFrom(goalTemplateDialog.onClose);
	}

	/*
	 * After add/edit/delete refresh selected row
	 */
	cancel(): void {
		this.selectRow({
			isSelected: false,
			data: null
		});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.goalSettingsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectRow({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.goalSettingsTable && this.goalSettingsTable.grid) {
			this.goalSettingsTable.grid.dataSet['willSelect'] = 'false';
			this.goalSettingsTable.grid.dataSet.deselectAll();
		}
	}

	private statusMapper = (value: string | boolean) => {
		const badgeClass = value === 'Active' ? 'success' : 'danger';
		value =
			value === 'Active'
				? this.getTranslation('PIPELINES_PAGE.ACTIVE')
				: this.getTranslation('PIPELINES_PAGE.INACTIVE');
		return {
			text: value,
			class: badgeClass
		};
	};
}
