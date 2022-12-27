import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	IEditEntityByMemberInput,
	IEmployee,
	IOrganization,
	IOrganizationContact
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';
import { OrganizationContactService } from '../../../../../@core/services/organization-contact.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@Component({
	selector: 'ga-edit-employee-contacts',
	templateUrl: './edit-employee-contact.component.html',
  	styles: [
		`
			:host {
        		overflow-y: auto;
				height: calc(100vh - 20.5rem);
			}
		`
	]
})
export class EditEmployeeContactComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	private _ngDestroy$ = new Subject<void>();

	organizationContact: IOrganizationContact[] = [];
	employeeContact: IOrganizationContact[] = [];

	selectedEmployee: IEmployee;
	organization: IOrganization;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly toastrService: ToastrService,
		private readonly employeeStore: EmployeeStore,
		readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				this.organization = organization;
			});

		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.selectedEmployee = emp;
				if (this.selectedEmployee) {
					this.loadContacts();
				}
			});
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	async submitForm(formInput: IEditEntityByMemberInput, removed: boolean) {
		try {
			if (formInput.member) {
				await this.organizationContactService.updateByEmployee(
					formInput
				);
				this.loadContacts();
				this.toastrService.success(
					removed
						? 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_REMOVED'
						: 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_ADDED'
				);
			}
		} catch (error) {
			this.toastrService.danger('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
		}
	}

	private async loadContacts() {
		await this.loadSelectedEmployeeContacts();
		const orgContacts = await this.getOrganizationContact();
		const selectedContactsIds = this.employeeContact.map((d) => d.id);
		if (orgContacts) {
			this.organizationContact = orgContacts.filter(
				(contact) => selectedContactsIds.indexOf(contact.id) < 0
			);
		}
	}

	private async loadSelectedEmployeeContacts() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const organizationId = this.organization.id;
		this.employeeContact = await this.organizationContactService.getAllByEmployee(
			this.selectedEmployee.id,
			{ organizationId, tenantId }
		);
	}

	private async getOrganizationContact() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const { items = [] } = await this.organizationContactService.getAll(
			[],
			{
				organizationId,
				tenantId
			}
		);
		return items;
	}
}
