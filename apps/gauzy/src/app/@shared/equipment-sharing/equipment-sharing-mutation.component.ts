import { OnInit, Component, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	EquipmentSharing,
	Equipment,
	EquipmentSharingStatusEnum,
	Employee,
	OrganizationTeams
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
	form: FormGroup;
	equipmentSharing: EquipmentSharing;
	employees: Employee[];
	disabled: boolean;
	selectedOrgId: string;
	requestStatus: string;
	participants = 'employees';

	teams: OrganizationTeams[];
	equipmentItems: Equipment[];
	selectedEmployees: string[] = [];
	selectedTeams: string[] = [];

	requestStatuses = Object.values(EquipmentSharingStatusEnum);

	private _ngDestroy$ = new Subject<void>();

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

	ngOnInit(): void {
		this.initializeForm();
		this.loadEquipmentItems();
		this.loadSelectedOrganization();
		this.loadEmployees();
		this.loadTeams();
		this.loadRequestStatus();
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
			return org.id === this.selectedOrgId || this.selectedOrgId === '';
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
}
