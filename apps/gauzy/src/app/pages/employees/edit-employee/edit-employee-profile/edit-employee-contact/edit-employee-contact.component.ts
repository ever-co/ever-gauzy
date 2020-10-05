import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	IEditEntityByMemberInput,
	IEmployee,
	IOrganization,
	IOrganizationContact
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';
import { OrganizationContactService } from '../../../../../@core/services/organization-contact.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ga-edit-employee-departments',
	templateUrl: './edit-employee-contact.component.html'
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
		private readonly toastrService: NbToastrService,
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
				this.toastrService.primary(
					this.getTranslation(
						removed
							? 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_REMOVED'
							: 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_ADDED'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
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
		this.employeeContact = await this.organizationContactService.getAllByEmployee(
			this.selectedEmployee.id
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
