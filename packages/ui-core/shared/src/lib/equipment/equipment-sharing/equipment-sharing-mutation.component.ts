import { OnInit, Component, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl } from '@angular/forms';
import {
	IEquipmentSharing,
	IEquipment,
	RequestApprovalStatusTypesEnum,
	RequestApprovalStatus,
	IEmployee,
	IOrganizationTeam,
	IEquipmentSharingPolicy,
	IOrganization,
	IEquipmentSharingRequest,
	EquipmentSharingParticipantEnum
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Store, distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EmployeesService,
	EquipmentService,
	EquipmentSharingPolicyService,
	EquipmentSharingService,
	OrganizationTeamsService
} from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-equipment-sharing-mutation',
	templateUrl: './equipment-sharing-mutation.component.html',
	styleUrls: ['./equipment-sharing-mutation.component.scss']
})
export class EquipmentSharingMutationComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	constructor(
		public readonly dialogRef: NbDialogRef<EquipmentSharingMutationComponent>,
		private readonly equipmentSharingService: EquipmentSharingService,
		private readonly equipmentService: EquipmentService,
		private readonly store: Store,
		private readonly fb: UntypedFormBuilder,
		public readonly translationService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly equipmentSharingPolicyService: EquipmentSharingPolicyService
	) {
		super(translationService);
	}

	form: UntypedFormGroup;
	equipmentSharing: IEquipmentSharing;
	employees: IEmployee[] = [];
	disabled: boolean;
	selectedOrganization: IOrganization;
	requestStatus: number;
	participants = EquipmentSharingParticipantEnum.EMPLOYEE;

	teams: IOrganizationTeam[];
	equipmentItems: IEquipment[];
	selectedEmployees: string[] = [];
	selectedTeams: string[] = [];
	equipmentSharingPolicies: IEquipmentSharingPolicy[] = [];
	selectedEquipmentSharingPolicy: string;
	requestStatuses = Object.values(RequestApprovalStatus);
	equipmentSharingParticipantEnum = EquipmentSharingParticipantEnum;

	date1 = new Date();
	date2 = new Date();
	filter = this.datePickerFilterPredicate.bind(this);

	periodsUnderUse = [];
	selectedItem: IEquipment;
	shareRequestDay: AbstractControl;
	shareStartDay: AbstractControl;
	shareEndDay: AbstractControl;

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganization = organization;

					this.initializeForm();
					this.loadEquipmentItems();
					this.loadEmployees();
					this.loadTeams();
					this.loadEquipmentSharingPolicy();
					this.loadRequestStatus();
					this.validateForm();
				}
			});
	}

	parseInt(value) {
		return parseInt(value, 10);
	}

	ngOnDestroy() {}

	async initializeForm() {
		this.form = this.fb.group({
			equipment: [this.equipmentSharing ? this.equipmentSharing.equipmentId : '', Validators.required],
			equipmentSharingPolicyId: [
				this.equipmentSharing && this.equipmentSharing.equipmentSharingPolicyId
					? this.equipmentSharing.equipmentSharingPolicyId
					: '',
				Validators.required
			],
			employees: [this.equipmentSharing ? this.equipmentSharing.employees.map((emp) => emp.id) : []],
			teams: [this.equipmentSharing ? this.equipmentSharing.teams.map((team) => team.id) : []],
			shareRequestDay: [
				this.equipmentSharing ? new Date(this.equipmentSharing.shareRequestDay) : new Date(Date.now())
			],
			shareStartDay: [this.equipmentSharing ? new Date(this.equipmentSharing.shareStartDay) : null],
			shareEndDay: [this.equipmentSharing ? new Date(this.equipmentSharing.shareEndDay) : null],
			status: [this.requestStatus],
			name: [
				this.equipmentSharing && this.equipmentSharing.name ? this.equipmentSharing.name : '',
				Validators.required
			]
		});

		/**
		 * Auto select participants (TEAM/EMPLOYEE)
		 */
		const { teams } = this.form.getRawValue();
		if (isNotEmpty(teams)) {
			this.participants = EquipmentSharingParticipantEnum.TEAM;
		} else {
			this.participants = EquipmentSharingParticipantEnum.EMPLOYEE;
		}
	}

	async loadEquipmentSharingPolicy() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		this.equipmentSharingPolicies = (
			await this.equipmentSharingPolicyService.getAll([], {
				organizationId,
				tenantId
			})
		).items;
	}

	onEquipmentSharingPolicySelected(equipmentSharingPolicy: string) {
		this.selectedEquipmentSharingPolicy = equipmentSharingPolicy;
	}

	async onSaveRequest() {
		const shareRequest = {
			equipmentId: this.form.value['equipment'],
			equipment: this.equipmentItems.find((eq) => eq.id === this.form.value['equipment']),
			createdBy: '',
			createdByName: '',
			equipmentSharingPolicyId: this.form.value['equipmentSharingPolicyId'],
			employees: this.employees.filter((emp) => {
				return this.selectedEmployees.includes(emp.id);
			}),
			teams: this.teams.filter((team) => {
				return this.selectedTeams.includes(team.id);
			}),
			shareRequestDay: this.form.value['shareRequestDay'],
			shareStartDay: this.form.value['shareStartDay'],
			shareEndDay: this.form.value['shareEndDay'],
			status: this.requestStatus,
			name: this.form.value['name'],
			organizationId: this.selectedOrganization.id,
			tenantId: this.selectedOrganization.tenantId
		};

		let equipmentSharing: IEquipmentSharingRequest;

		if (this.equipmentSharing) {
			shareRequest.createdBy = this.equipmentSharing.createdBy;
			shareRequest.createdByName = this.equipmentSharing.createdByName;
			equipmentSharing = await this.equipmentSharingService.update(this.equipmentSharing.id, shareRequest);
		} else {
			equipmentSharing = await this.equipmentSharingService.create(shareRequest, this.selectedOrganization.id);
		}

		this.closeDialog(equipmentSharing);
	}

	async closeDialog(equipmentSharing?: IEquipmentSharingRequest) {
		this.dialogRef.close(equipmentSharing);
	}

	async loadEquipmentItems() {
		const { id, tenantId } = this.selectedOrganization;
		this.equipmentItems = (
			await this.equipmentService.getAll(['equipmentSharings'], {
				organizationId: id,
				tenantId
			})
		).items;
	}

	async loadEmployees() {
		const { id, tenantId } = this.selectedOrganization;
		this.employeesService
			.getAll(['user'], {
				organizationId: id,
				tenantId
			})
			.pipe(untilDestroyed(this))
			.subscribe(({ items }) => {
				this.employees = items;
			});
	}

	async loadTeams() {
		const { id, tenantId } = this.selectedOrganization;
		this.teams = (
			await this.organizationTeamsService.getAll(['members'], {
				organizationId: id,
				tenantId
			})
		).items;
	}

	loadRequestStatus() {
		this.requestStatus = this.equipmentSharing
			? this.equipmentSharing.status
			: RequestApprovalStatusTypesEnum.REQUESTED;
	}

	setRequestStatus(statusValue: string) {
		const selectedItem = this.equipmentItems.find((item) => {
			return item.id === statusValue;
		});

		if (this.equipmentSharing && this.equipmentSharing.status === RequestApprovalStatusTypesEnum.REFUSED) {
			this.requestStatus = RequestApprovalStatusTypesEnum.REFUSED;
			return;
		}

		if (selectedItem.autoApproveShare) {
			this.requestStatus = RequestApprovalStatusTypesEnum.APPROVED;
		} else {
			this.requestStatus = RequestApprovalStatusTypesEnum.REQUESTED;
		}
	}

	onEmployeesSelected(employees: string[]) {
		this.selectedEmployees = employees;

		this.form.get('employees').setValue(employees);
		this.form.get('employees').updateValueAndValidity();
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}

	onParticipantsChange(participants: EquipmentSharingParticipantEnum) {
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
			.valueChanges.pipe(untilDestroyed(this))
			.subscribe((valueId) => {
				this.selectedItem = this.equipmentItems.find((item) => {
					return item.id === valueId;
				});

				this.periodsUnderUse = [];
				if (this.selectedItem.equipmentSharings.length > 0) {
					this.selectedItem.equipmentSharings.forEach((equipmentSharing) => {
						this.periodsUnderUse.push({
							startDate: new Date(equipmentSharing.shareStartDay),
							endDate: new Date(equipmentSharing.shareEndDay)
						});
					});
				}
			});

		this.form.valueChanges.pipe(untilDestroyed(this)).subscribe((form) => {
			//check if start day is after share request day
			if (this.shareStartDay.value <= this.shareRequestDay.value) {
				this.shareStartDay.setErrors({
					invalid: true,
					beforeRequestDay: true,
					beforeRequestDayMsg: this.getTranslation('EQUIPMENT_SHARING_PAGE.MESSAGES.BEFORE_REQUEST_DAY_ERR')
				});
			}

			//check if user selects longer period than allowed
			const diffDays = Math.ceil(Math.abs((this.shareEndDay.value - this.shareStartDay.value) / oneDay));

			if (
				this.selectedItem &&
				this.selectedItem.maxSharePeriod &&
				diffDays + 1 > this.selectedItem.maxSharePeriod
			) {
				this.shareEndDay.setErrors({
					invalid: true,
					exceedAllowedDays: true,
					exceedAllowedDaysMsg:
						this.getTranslation('EQUIPMENT_SHARING_PAGE.MESSAGES.EXCEED_PERIOD_ERR') +
						this.selectedItem.maxSharePeriod
				});
			}

			// check of share end date after share start date
			if (this.shareEndDay.value < this.shareStartDay.value) {
				this.shareEndDay.setErrors({
					invalid: true,
					beforeStartDate: true,
					beforeStartDateMsg: this.getTranslation('EQUIPMENT_SHARING_PAGE.MESSAGES.BEFORE_START_DATE_ERR')
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

			const dateItemToBeReturned = followingPeriods.length > 0 ? followingPeriods[0].startDate : null;

			if (dateItemToBeReturned && this.shareEndDay.value > dateItemToBeReturned) {
				this.shareEndDay.setErrors({
					invalid: true,
					itemInUse: true,
					itemInUseMsg:
						this.getTranslation('EQUIPMENT_SHARING_PAGE.MESSAGES.ITEM_RETURNED_BEFORE_ERR') +
						dateItemToBeReturned.toLocaleString().split(',')[0]
				});
			}
		});
	}

	checkIfDateBetweenPeriods(periods: { startDate: Date; endDate: Date }[], dateForCheck: Date): boolean {
		let dateIsInGivenPeriods = false;
		periods.forEach((period) => {
			if (dateForCheck >= period.startDate && dateForCheck <= period.endDate) {
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

	getStatus(id: number) {
		switch (id) {
			case RequestApprovalStatusTypesEnum.REQUESTED:
				return this.getTranslation('APPROVAL_REQUEST_PAGE.REQUESTED');
			case RequestApprovalStatusTypesEnum.REFUSED:
				return this.getTranslation('APPROVAL_REQUEST_PAGE.REFUSED');
			case RequestApprovalStatusTypesEnum.APPROVED:
				return this.getTranslation('APPROVAL_REQUEST_PAGE.APPROVED');
		}
	}
}
