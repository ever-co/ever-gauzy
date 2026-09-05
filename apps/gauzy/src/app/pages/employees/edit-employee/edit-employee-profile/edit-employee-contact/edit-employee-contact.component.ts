import { Component, OnDestroy, OnInit } from '@angular/core';
import { IEditEntityByMemberInput, IEmployee, IOrganization, IOrganizationContact } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EmployeeStore, OrganizationContactService, ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
    selector: 'ga-edit-employee-contacts',
    templateUrl: './edit-employee-contact.component.html',
    styles: [
        /*
         * The tabset hands this tab the height the card body has left over
         * (edit-employee-profile.component.scss), so there is nothing here left
         * to measure: the `height: calc(100vh - 20.5rem)` this used to carry was
         * a second guess at the page chrome alongside the card's own, and when
         * the two disagreed the tab stopped short and left a band of bare card
         * body under the panel.
         *
         * `.container-contact` then grows into the tab rather than asking for
         * `height: 100%` of a host whose own size comes out of flex layout — a
         * percentage the cascade cannot resolve. `flex-shrink: 0` because the
         * host scrolls: a long list keeps its height and scrolls inside the host.
         */
        `
			:host {
				overflow-y: auto;
				display: flex;
				flex-direction: column;

				.container-contact {
					background-color: var(--gauzy-card-2);
					padding: 1rem;
					height: auto;
					flex: 1 0 auto;
				}

				nb-card {
					margin: 0 !important;
					background-color: var(--gauzy-card-3) !important;
					border-radius: var(--card-border-radius);
				}
			}
		`
    ],
    standalone: false
})
export class EditEmployeeContactComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
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
		this.store.selectedOrganization$.pipe(untilDestroyed(this)).subscribe((organization) => {
			this.organization = organization;
		});

		this.employeeStore.selectedEmployee$.pipe(untilDestroyed(this)).subscribe((emp) => {
			this.selectedEmployee = emp;
			if (this.selectedEmployee) {
				this.loadContacts();
			}
		});
	}

	ngOnDestroy(): void {}

	async submitForm(formInput: IEditEntityByMemberInput, removed: boolean) {
		try {
			if (formInput.member) {
				await this.organizationContactService.updateByEmployee(formInput);
				this.loadContacts();
				this.toastrService.success(
					removed ? 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_REMOVED' : 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_ADDED'
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
			this.organizationContact = orgContacts.filter((contact) => selectedContactsIds.indexOf(contact.id) < 0);
		}
	}

	private async loadSelectedEmployeeContacts() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const organizationId = this.organization.id;
		this.employeeContact = await this.organizationContactService.getAllByEmployee(this.selectedEmployee.id, {
			organizationId,
			tenantId
		});
	}

	private async getOrganizationContact() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const { items = [] } = await this.organizationContactService.getAll([], {
			organizationId,
			tenantId
		});
		return items;
	}
}
