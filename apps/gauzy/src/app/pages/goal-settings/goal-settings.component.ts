import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { first, takeUntil } from 'rxjs/operators';
import { GoalSettingsService } from '../../@core/services/goal-settings.service';
import { Subject } from 'rxjs';
import { AlertModalComponent } from '../../@shared/alert-modal/alert-modal.component';
import { Store } from '../../@core/services/store.service';
import { EditKpiComponent } from './edit-kpi/edit-kpi.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import {
	ComponentLayoutStyleEnum,
	GoalOwnershipEnum,
	GoalGeneralSetting
} from '@gauzy/models';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import {
	getYear,
	getQuarter,
	addDays,
	lastDayOfYear,
	startOfQuarter,
	endOfQuarter,
	lastDayOfQuarter,
	startOfYear,
	endOfYear
} from 'date-fns';
import { FormGroup, FormBuilder } from '@angular/forms';

@Component({
	selector: 'ga-goal-settings',
	templateUrl: './goal-settings.component.html',
	styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableData = new LocalDataSource();
	generalSettingsForm: FormGroup;
	smartTableSettings: object;
	selectedTimeFrame: any = null;
	selectedKPI: any = null;
	selectedTab = 'Set Time Frame';
	selectedOrganizationId: string;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	disableButton = true;
	goalTimeFrames: any[];
	goalGeneralSettings: GoalGeneralSetting;
	goalOwnershipEnum = GoalOwnershipEnum;
	predefinedTimeFrames = [];
	@ViewChild('smartTable') smartTable;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private goalSettingService: GoalSettingsService,
		private toastrService: NbToastrService,
		private store: Store,
		private router: Router,
		private fb: FormBuilder
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
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
		await this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					await this._loadTableData(null);
				}
			});
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.GOAL_SETTINGS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedKPI = null;
				this.selectedTimeFrame = null;
			});
	}

	saveGeneralSettings() {
		this.goalSettingService
			.updateGeneralSettings(
				this.goalGeneralSettings.id,
				this.generalSettingsForm.value
			)
			.then((res) => {
				if (res) {
					this.toastrService.success(
						this.getTranslation(
							'TOASTR.MESSAGE.GOAL_GENERAL_SETTING_UPDATED'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadTableData(null);
				}
			});
	}

	tabChange(e) {
		this.selectedTab = e.tabTitle;
		this._loadTableSettings(e.tabTitle);
		this._applyTranslationOnSmartTable();
		this._loadTableData(e.tabTitle);
		if (this.smartTable) {
			this.selectedKPI = null;
			this.selectedTimeFrame = null;
			this.smartTable.grid.dataSet.willSelect = 'false';
		}
	}

	selectRow({ isSelected, data }) {
		if (isSelected) {
			this.selectedTab === 'KPI'
				? (this.selectedKPI = data)
				: (this.selectedTimeFrame = data);
		} else {
			this.selectedTab === 'KPI'
				? (this.selectedKPI = null)
				: (this.selectedTimeFrame = null);
		}
		if (this.smartTable) {
			this.smartTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
	}

	private async _loadTableData(tab) {
		this.smartTableData.empty();
		this.goalTimeFrames = [];
		const findObj = {
			organization: {
				id: this.selectedOrganizationId
			}
		};
		await this.goalSettingService
			.getAllGeneralSettings(findObj)
			.then((generalSettings) => {
				const { items } = generalSettings;
				this.goalGeneralSettings = items.pop();
				this.generalSettingsForm.patchValue({
					...this.goalGeneralSettings
				});
			});
		if (tab === 'KPI') {
			await this.goalSettingService.getAllKPI(findObj).then((res) => {
				this.smartTableData.load(res.items);
				this.goalTimeFrames = res.items;
				if (this.smartTable) {
					this.smartTable.grid.dataSet.willSelect = 'false';
				}
			});
		} else {
			await this.goalSettingService
				.getAllTimeFrames(findObj)
				.then((res) => {
					if (!!res) {
						this.smartTableData.load(res.items);
						this.goalTimeFrames = res.items;
						if (this.smartTable) {
							this.smartTable.grid.dataSet.willSelect = 'false';
						}
						this.generateTimeFrames();
					}
				});
		}
	}

	private _loadTableSettings(tab) {
		if (tab === 'KPI') {
			this.smartTableSettings = {
				actions: false,
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string'
					},
					currentValue: {
						title: 'Current value',
						type: 'number',
						filter: false
					},
					targetValue: {
						title: 'Target value',
						type: 'number',
						filter: false
					},
					updatedAt: {
						title: 'Last Updated',
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent
					}
				}
			};
		} else {
			this.smartTableSettings = {
				actions: false,
				columns: {
					name: {
						title: this.getTranslation('SM_TABLE.NAME'),
						type: 'string'
					},
					status: {
						title: this.getTranslation('SM_TABLE.STATUS'),
						type: 'string',
						filter: false
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
					}
				}
			};
		}
	}

	generateTimeFrames() {
		const today = new Date();
		let date = today;
		let year = getYear(today);
		this.predefinedTimeFrames = [];
		// Add Quarters
		if (getQuarter(date) > 2) {
			year = getYear(addDays(lastDayOfYear(today), 1));
		}
		while (getYear(date) <= year) {
			const timeFrameName = `Q${getQuarter(date)}-${getYear(date)}`;
			this.predefinedTimeFrames.push({
				name: timeFrameName,
				start: new Date(startOfQuarter(date)),
				end: new Date(endOfQuarter(date))
			});
			date = addDays(lastDayOfQuarter(date), 1);
		}
		// Annual Time Frames
		this.predefinedTimeFrames.push({
			name: `Annual-${getYear(today)}`,
			start: new Date(startOfYear(today)),
			end: new Date(endOfYear(today))
		});
		if (year > getYear(today)) {
			this.predefinedTimeFrames.push({
				name: `Annual-${year}`,
				start: new Date(startOfYear(addDays(lastDayOfYear(today), 1))),
				end: new Date(endOfYear(addDays(lastDayOfYear(today), 1)))
			});
		}
	}

	async editTimeFrame(source, selectedItem?: any) {
		this.predefinedTimeFrames = this.predefinedTimeFrames.filter(
			(timeFrame) => {
				return (
					this.goalTimeFrames.findIndex(
						(goalTimeFrame) => goalTimeFrame.name === timeFrame.name
					) === -1
				);
			}
		);
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
			if (source === 'add') {
				this.selectedTimeFrame = null;
				this.smartTable.grid.dataSet.willSelect = 'false';
			}
		}
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				timeFrame: this.selectedTimeFrame,
				type: source,
				predefinedTimeFrames: this.predefinedTimeFrames
			},
			closeOnBackdropClick: false
		});

		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this._loadTableSettings(null);
			await this._loadTableData(null);
		}
	}

	async editKPI(source, selectedItem?: any) {
		if (selectedItem) {
			this.selectRow({
				isSelected: true,
				data: selectedItem
			});
			if (source === 'add') {
				this.selectedKPI = null;
				this.smartTable.grid.dataSet.willSelect = 'false';
			}
		}
		const kpiDialog = this.dialogService.open(EditKpiComponent, {
			context: {
				selectedKPI: this.selectedKPI,
				type: source
			},
			closeOnBackdropClick: false
		});
		const response = await kpiDialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			this._loadTableSettings('KPI');
			await this._loadTableData('KPI');
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
					title: 'Delete Time Frame',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteTimeFrame(this.selectedTimeFrame.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.danger(
								this.getTranslation(
									'TOASTR.MESSAGE.TIME_FRAME_DELETED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this._loadTableSettings(null);
							await this._loadTableData(null);
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
					title: 'Delete KPI',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.goalSettingService
					.deleteKPI(this.selectedKPI.id)
					.then(async (res) => {
						if (res) {
							this.toastrService.danger(
								'KPI Deleted',
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this._loadTableSettings('KPI');
							await this._loadTableData('KPI');
						}
					});
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadTableSettings(null);
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
