import {
	DefaultValueDateTypeEnum,
	Organization,
	PermissionsEnum,
	RolePermissions,
	User,
	Tag,
	Invoice
} from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { ProposalViewModel } from '../../pages/proposals/proposals.component';

export class Store {
	private _selectedOrganization: Organization;
	private _selectedProposal: ProposalViewModel;
	private _userRolePermissions: RolePermissions[];
	private _user: User;
	private _selectedTags: Tag[];
	private _selectedInvoice: Invoice;
	Permissions: boolean;

	user$: BehaviorSubject<User> = new BehaviorSubject(this.user);
	selectedTags$: BehaviorSubject<Tag[]> = new BehaviorSubject(
		this.selectedTags
	);
	selectedInvoice$: BehaviorSubject<Invoice> = new BehaviorSubject(
		this.selectedInvoice
	);
	selectedOrganization$: BehaviorSubject<Organization> = new BehaviorSubject(
		this.selectedOrganization
	);

	private _selectedEmployee: SelectedEmployee;
	selectedEmployee$: BehaviorSubject<SelectedEmployee> = new BehaviorSubject(
		this.selectedEmployee
	);

	private _selectedDate: Date;
	selectedDate$: BehaviorSubject<Date> = new BehaviorSubject(
		this.selectedDate
	);

	userRolePermissions$: BehaviorSubject<
		RolePermissions[]
	> = new BehaviorSubject(this.userRolePermissions);

	get selectedOrganization(): Organization {
		return this._selectedOrganization;
	}
	get selectedTags(): Tag[] {
		return this._selectedTags;
	}

	set selectedEmployee(employee: SelectedEmployee) {
		this._selectedEmployee = employee;
		this.selectedEmployee$.next(employee);
	}

	get selectedEmployee(): SelectedEmployee {
		return this._selectedEmployee;
	}

	set selectedOrganization(organization: Organization) {
		this.selectedOrganization$.next(organization);
		this._selectedOrganization = organization;
	}
	set selectedTags(tag: Tag[]) {
		this.selectedTags$.next(tag);
		this._selectedTags = tag;
	}

	get token(): string | null {
		return localStorage.getItem('token') || null;
	}

	set token(token: string) {
		if (token == null) {
			localStorage.removeItem('token');
		} else {
			localStorage.setItem('token', token);
		}
	}

	get userId(): User['id'] | null {
		return localStorage.getItem('_userId') || null;
	}

	set userId(id: User['id'] | null) {
		if (id == null) {
			localStorage.removeItem('_userId');
		} else {
			localStorage.setItem('_userId', id);
		}
	}

	get user(): User {
		return this._user;
	}

	set user(user: User) {
		this._user = user;
		this.user$.next(user);
	}

	get selectedDate() {
		return this._selectedDate;
	}

	set selectedDate(date: Date) {
		this._selectedDate = date;
		this.selectedDate$.next(date);
	}

	get selectedInvoice(): Invoice {
		return this._selectedInvoice;
	}

	set selectedInvoice(invoice: Invoice) {
		this._selectedInvoice = invoice;
		this.selectedInvoice$.next(invoice);
	}

	get selectedProposal(): ProposalViewModel {
		return this._selectedProposal;
	}

	set selectedProposal(proposal: ProposalViewModel) {
		this._selectedProposal = proposal;
	}

	get userRolePermissions(): RolePermissions[] {
		return this._userRolePermissions;
	}

	set userRolePermissions(rolePermissions: RolePermissions[]) {
		this._userRolePermissions = rolePermissions;
		this.userRolePermissions$.next(rolePermissions);
	}

	hasPermission(permission: PermissionsEnum) {
		return !!(this._userRolePermissions || []).find(
			(p) => p.permission === permission && p.enabled
		);
	}

	getDateFromOrganizationSettings() {
		const dateObj = this._selectedDate;

		switch (this.selectedOrganization.defaultValueDateType) {
			case DefaultValueDateTypeEnum.TODAY: {
				return new Date(Date.now());
			}
			case DefaultValueDateTypeEnum.END_OF_MONTH: {
				return new Date(dateObj.getFullYear(), dateObj.getMonth(), 0);
			}
			case DefaultValueDateTypeEnum.START_OF_MONTH: {
				return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
			}
			default: {
				return new Date(Date.now());
			}
		}
	}

	get serverConnection() {
		return localStorage.getItem('serverConnection');
	}

	set serverConnection(val: string) {
		localStorage.setItem('serverConnection', val);
	}

	clear() {
		localStorage.clear();
	}
}
