import { OnInit, Component, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	EquipmentSharing,
	Equipment,
	EquipmentSharingStatusEnum
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EmployeesService } from '../../@core/services/employees.service';
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
	//todo
	employees: any[];
	disabled: boolean;
	teams: any[];
	equipmentItems: Equipment[];
	requestStatuses = Object.values(EquipmentSharingStatusEnum);
	selectedOrgId;
	requestStatus;

	selectedEmployees: string[] = [];
	selectedTeams: string[] = [];

	private _ngDestroy$ = new Subject<void>();

	constructor(
		public dialogRef: NbDialogRef<EquipmentSharingMutationComponent>,
		private equipmentSharingService: EquipmentSharingService,
		private equipmentService: EquipmentService,
		private store: Store,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		private employeesService: EmployeesService
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.initializeForm();
		this.getEquipmentItems();
		this.setSelectedOrganization();
		this.getEmployees();
		console.log(this.equipmentSharing);
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
			team: [''],
			shareRequestDay: [
				this.equipmentSharing
					? new Date(this.equipmentSharing.shareRequestDay)
					: new Date(Date.now())
			],
			shareStartDay: [
				this.equipmentSharing
					? new Date(this.equipmentSharing.shareStartDay)
					: ''
			],
			shareEndDay: [
				this.equipmentSharing
					? new Date(this.equipmentSharing.shareEndDay)
					: ''
			],
			status: [EquipmentSharingStatusEnum.REQUESTED]
		});
	}

	async onSaveRequest() {
		console.log(
			this.employees.filter((emp) => {
				return this.selectedEmployees.includes(emp.id);
			})
		);
		const shareRequest = {
			equipmentId: this.form.value['equipment'],
			equipment: this.equipmentItems.find(
				(eq) => eq.id === this.form.value['equipment']
			),
			employees: this.employees.filter((emp) => {
				return this.selectedEmployees.includes(emp.id);
			}),
			teams: null,
			shareRequestDay: this.form.value['shareRequestDay'],
			shareStartDay: this.form.value['shareStartDay'],
			shareEndDay: this.form.value['shareEndDay'],
			status: this.form.value['status']
		};

		console.log(shareRequest);
		const equipmentSharing = await this.equipmentSharingService.create(
			shareRequest
		);

		this.closeDialog(equipmentSharing);
	}

	async closeDialog(equipmentSharing?: EquipmentSharing) {
		this.dialogRef.close(equipmentSharing);
	}

	async getEquipmentItems() {
		this.equipmentItems = (await this.equipmentService.getAll()).items;
	}

	async getSelectedOrganization() {}

	async getEmployees() {
		this.employeesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items
					.filter((emp) => {
						return (
							emp.orgId === this.selectedOrgId ||
							this.selectedOrgId === ''
						);
					})
					.map((emp) => {
						return {
							id: emp.id,
							firstName: emp.user.firstName,
							lastName: emp.user.lastName,
							imageUrl: emp.user.imageUrl,
							organizationId: emp.orgId
						};
					});
			});
	}

	async setSelectedOrganization() {
		this.selectedOrgId = this.store.selectedOrganization
			? this.store.selectedOrganization.id
			: '';
	}

	private setRequestStatus($event: any) {
		const selectedItem = this.equipmentItems.find((item) => {
			return item.id === $event.id;
		});

		if (selectedItem.autoApproveShare) {
			this.requestStatus = EquipmentSharingStatusEnum.APPROVED;
		} else {
			this.requestStatus = EquipmentSharingStatusEnum.REQUESTED;
		}
	}

	getName(firstName: string, lastName: string) {
		return firstName && lastName
			? firstName + ' ' + lastName
			: firstName || lastName;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	onEmployeesSelected(employeeSelection: string[]) {
		this.selectedEmployees = employeeSelection;
	}

	//todo disable either org or emp
	//status updated based on item
}
