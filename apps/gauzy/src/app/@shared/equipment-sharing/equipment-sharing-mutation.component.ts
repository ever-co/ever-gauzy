import { OnInit, Component, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import {
	FormGroup,
	FormBuilder,
	Validators,
	AbstractControl
} from '@angular/forms';
import {
	EquipmentSharing,
	Equipment,
	EquipmentSharingStatusEnum,
	Employee,
	OrganizationTeam
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EmployeesService } from '../../@core/services/employees.service';
import { OrganizationTeamsService } from '../../@core/services/organization-teams.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Store } from '../../@core/services/store.service';

export interface RequestEmployee {
	id: string;
	firstName: string;
	lastName: string;
	imageUrl: string;
	organizationId: string;
}

@Component({
	selector: 'ngx-equipment-mutation',
	templateUrl: './equipment-sharing-mutation.component.html',
	styleUrls: ['./equipment-sharing-mutation.component.scss']
})
export class EquipmentSharingMutationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		public dialogRef: NbDialogRef<EquipmentSharingMutationComponent>,
		private equipmentSharingService: EquipmentSharingService,
		private equipmentService: EquipmentService,
		private store: Store,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		private employeesService: EmployeesService,
		private organizationTeamsService: OrganizationTeamsService
	) {
		super(translationService);
	}
	form: FormGroup;
	equipmentSharing: EquipmentSharing;
	employees: Employee[];
	disabled: boolean;
	selectedOrgId: string;
	requestStatus: string;
	participants = 'employees';

	teams: OrganizationTeam[];
	equipmentItems: Equipment[];
	selectedEmployees: string[] = [];
	selectedTeams: string[] = [];

	requestStatuses = Object.values(EquipmentSharingStatusEnum);

	private _ngDestroy$ = new Subject<void>();

	date1 = new Date();
	date2 = new Date();
	filter = this.datePickerFilterPredicate.bind(this);

	periodsUnderUse = [];
	selectedItem: Equipment;
	shareRequestDay: AbstractControl;
	shareStartDay: AbstractControl;
	shareEndDay: AbstractControl;

	ngOnInit(): void {
		this.initializeForm();
		this.loadEquipmentItems();
		this.loadSelectedOrganization();
		this.loadEmployees();
		this.loadTeams();
		this.loadRequestStatus();
		this.validateForm();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
	async initializeForm() {
		this.form = this.fb.group({
			equipment: [
				this.equipmentSharing ? this.equipmentSharing.equipment.id : '',
				Validators.required
			],
			employees: [
				this.equipmentSharing
					? this.equipmentSharing.employees.map((emp) => emp.id)
					: []
			],
			teams: [
				this.equipmentSharing
					? this.equipmentSharing.teams.map((team) => team.id)
					: []
			],
			shareRequestDay: [
				this.equipmentSharing
					? new Date(this.equipmentSharing.shareRequestDay)
					: new Date(Date.now())
			],
			shareStartDay: [
				this.equipmentSharing
					? new Date(this.equipmentSharing.shareStartDay)
					: null
			],
			shareEndDay: [
				this.equipmentSharing
					? new Date(this.equipmentSharing.shareEndDay)
					: null
			],
			status: [this.requestStatus]
		});
	}

	async onSaveRequest() {
		const shareRequest = {
			equipmentId: this.form.value['equipment'],
			equipment: this.equipmentItems.find(
				(eq) => eq.id === this.form.value['equipment']
			),
			employees: this.employees.filter((emp) => {
				return this.selectedEmployees.includes(emp.id);
			}),
			teams: this.teams.filter((team) => {
				return this.selectedTeams.includes(team.id);
			}),
			shareRequestDay: this.form.value['shareRequestDay'],
			shareStartDay: this.form.value['shareStartDay'],
			shareEndDay: this.form.value['shareEndDay'],
			status: this.requestStatus
		};

		let equipmentSharing: EquipmentSharing;

		if (this.equipmentSharing) {
			equipmentSharing = await this.equipmentSharingService.update(
				this.equipmentSharing.id,
				shareRequest
			);
		} else {
			equipmentSharing = await this.equipmentSharingService.create(
				shareRequest
			);
		}

		this.closeDialog(equipmentSharing);
	}

	async closeDialog(equipmentSharing?: EquipmentSharing) {
		this.dialogRef.close(equipmentSharing);
	}

	async loadEquipmentItems() {
		this.equipmentItems = (await this.equipmentService.getAll()).items;
	}

	async loadEmployees() {
		this.employeesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items.filter((emp) => {
					return (
						emp.orgId === this.selectedOrgId ||
						this.selectedOrgId === ''
					);
				});
			});
	}

	async loadTeams() {
		this.teams = (
			await this.organizationTeamsService.getAll(['members'])
		).items.filter((org) => {
			return (
				org.organizationId === this.selectedOrgId ||
				this.selectedOrgId === ''
			);
		});
	}

	async loadSelectedOrganization() {
		this.selectedOrgId = this.store.selectedOrganization
			? this.store.selectedOrganization.id
			: '';
	}

	loadRequestStatus() {
		this.requestStatus = this.equipmentSharing
			? this.equipmentSharing.status
			: EquipmentSharingStatusEnum.REQUESTED;
	}

	setRequestStatus(statusValue: string) {
		const selectedItem = this.equipmentItems.find((item) => {
			return item.id === statusValue;
		});

		if (
			this.equipmentSharing &&
			this.equipmentSharing.status === EquipmentSharingStatusEnum.ACTIVE
		) {
			this.requestStatus = EquipmentSharingStatusEnum.ACTIVE;
			return;
		}

		if (selectedItem.autoApproveShare) {
			this.requestStatus = EquipmentSharingStatusEnum.APPROVED;
		} else {
			this.requestStatus = EquipmentSharingStatusEnum.REQUESTED;
		}
	}

	onEmployeesSelected(employeeSelection: string[]) {
		this.selectedEmployees = employeeSelection;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}

	onParticipantsChange(participants: string) {
		this.participants = participants;
	}

	validateForm(): void {
		if (this.equipmentSharing) {
			this.selectedItem = this.equipmentSharing.equipment;
		}

		this.shareRequestDay = this.form.get('shareRequestDay');
		this.shareStartDay = this.form.get('shareStartDay');
		this.shareEndDay = this.form.get('shareEndDay');

		// hours * minutes * seconds * milliseconds
		const oneDay = 24 * 60 * 60 * 1000;

		this.form
			.get('equipment')
			.valueChanges.pipe(takeUntil(this._ngDestroy$))
			.subscribe((valueId) => {
				this.selectedItem = this.equipmentItems.find((item) => {
					return item.id === valueId;
				});

				this.periodsUnderUse = [];
				this.selectedItem.equipmentSharings.forEach(
					(equipmentSharing) => {
						this.periodsUnderUse.push({
							startDate: new Date(equipmentSharing.shareStartDay),
							endDate: new Date(equipmentSharing.shareEndDay)
						});
					}
				);
			});

		this.form.valueChanges
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((form) => {
				//check if start day is after share request day
				if (this.shareStartDay.value <= this.shareRequestDay.value) {
					this.shareStartDay.setErrors({
						invalid: true,
						beforeRequestDay: true,
						beforeRequestDayMsg: this.getTranslation(
							'EQUIPMENT_SHARING_PAGE.MESSAGES.BEFORE_REQUEST_DAY_ERR'
						)
					});
				}

				//check if user selects longer period than allowed
				const diffDays = Math.ceil(
					Math.abs(
						(this.shareEndDay.value - this.shareStartDay.value) /
							oneDay
					)
				);

				if (
					this.selectedItem &&
					this.selectedItem.maxSharePeriod &&
					diffDays + 1 > this.selectedItem.maxSharePeriod
				) {
					this.shareEndDay.setErrors({
						invalid: true,
						exceedAllowedDays: true,
						exceedAllowedDaysMsg:
							this.getTranslation(
								'EQUIPMENT_SHARING_PAGE.MESSAGES.EXCEED_PERIOD_ERR'
							) + this.selectedItem.maxSharePeriod
					});
				}

				// check of share end date after share start date
				if (this.shareEndDay.value < this.shareStartDay.value) {
					this.shareEndDay.setErrors({
						invalid: true,
						beforeStartDate: true,
						beforeStartDateMsg: this.getTranslation(
							'EQUIPMENT_SHARING_PAGE.MESSAGES.BEFORE_START_DATE_ERR'
						)
					});
				}

				//check if end date is after period in use
				//
				//find nearest period in use and get start date
				const followingPeriods = [...this.periodsUnderUse]
					.sort((a, b) => a.startDate - b.startDate)
					.filter((period) => {
						return period.startDate > this.shareStartDay.value;
					});

				const dateItemToBeReturned =
					followingPeriods.length > 0
						? followingPeriods[0].startDate
						: null;

				if (
					dateItemToBeReturned &&
					this.shareEndDay.value > dateItemToBeReturned
				) {
					this.shareEndDay.setErrors({
						invalid: true,
						itemInUse: true,
						itemInUseMsg:
							this.getTranslation(
								'EQUIPMENT_SHARING_PAGE.MESSAGES.ITEM_RETURNED_BEFORE_ERR'
							) +
							dateItemToBeReturned.toLocaleString().split(',')[0]
					});
				}
			});
	}

	checkIfDateBetweenPeriods(
		periods: { startDate: Date; endDate: Date }[],
		dateForCheck: Date
	): boolean {
		let dateIsInGivenPeriods = false;
		periods.forEach((period) => {
			if (
				dateForCheck >= period.startDate &&
				dateForCheck <= period.endDate
			) {
				dateIsInGivenPeriods = true;
			}
		});

		return dateIsInGivenPeriods;
	}

	datePickerFilterPredicate(date: Date): boolean {
		if (!this.selectedItem) {
			return true;
		}

		return !this.checkIfDateBetweenPeriods(this.periodsUnderUse, date);
	}
}
