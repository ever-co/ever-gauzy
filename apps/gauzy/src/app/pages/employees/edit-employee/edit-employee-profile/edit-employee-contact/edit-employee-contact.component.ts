import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import {
	ContactType,
	IEmployee,
	IOrganization,
	IOrganizationContact,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { EmployeeStore, ErrorHandlingService, OrganizationContactService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { initialsOf, IPersonChip, nameOf, personOf } from '../../../../projects/components/project-view/project-view.utils';

/** Relations the table reads from the organization's contacts: their people and their projects. */
const CONTACT_RELATIONS: string[] = ['members.user', 'projects'];

/** i18n prefix of the tab's own strings. */
const T = 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.CONTACTS_TAB';

type TypeTone = 'info' | 'success' | 'warning' | 'basic';

/** One row of the employee's contacts table. */
export interface IEmployeeContactRow {
	id: string;
	name: string;
	imageUrl?: string;
	initials: string;
	/** The avatar tint, derived from the name. */
	color: string;
	email?: string;
	phone?: string;
	type: { key: string; tone: TypeTone } | null;
	/** Names of the contact's projects, for the Projects column. */
	projectNames: string[];
	/** Every project's name, for the column's tooltip. */
	projectList: string;
	/** Every member's name, for the assign dialog's tooltip. */
	memberNames: string;
	/** How many people work with the contact. */
	memberCount: number;
}

/** Whose memberships a dialog changes: fixed when it opens, so a later switch of employee cannot redirect it. */
interface IMembershipContext {
	employee: IEmployee;
	organization: IOrganization;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-contacts',
	templateUrl: './edit-employee-contact.component.html',
	styleUrls: ['./edit-employee-contact.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditEmployeeContactComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	/** The remove confirmation; its context is the row being removed. */
	@ViewChild('removeDialog', { static: true }) readonly removeDialog: TemplateRef<IEmployeeContactRow>;
	/** The assign dialog: a searchable checklist of the contacts the employee is not assigned to yet. */
	@ViewChild('assignDialog', { static: true }) readonly assignDialog: TemplateRef<void>;
	private _assignRef: NbDialogRef<void> | null = null;
	/** The employee and organization the open assign dialog was opened for. */
	private _assignContext: IMembershipContext | null = null;
	private _removeRef: NbDialogRef<IEmployeeContactRow> | null = null;

	private subject$: Subject<boolean> = new Subject();
	/** Guards against an older read landing after a newer one. */
	private _loadId = 0;

	public readonly T = T;
	public rows: IEmployeeContactRow[] = [];
	/** The organization's contacts the employee is not assigned to: what the assign dialog offers. */
	public availableRows: IEmployeeContactRow[] = [];
	public selectedEmployee: IEmployee;
	public organization: IOrganization;

	public loading = false;
	public saving = false;
	public removingId: string | null = null;
	public searchTerm = '';
	public assignSearch = '';
	public assignSelection = new Set<string>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly _organizationContactService: OrganizationContactService,
		private readonly _toastrService: ToastrService,
		private readonly _employeeStore: EmployeeStore,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				tap(() => this.loadContacts()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				filter(([organization, employee]) => !!organization && !!employee),
				tap(([organization, employee]) => this.selectContext(organization, employee)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Switches the tab to an employee (or organization). Another employee's rows and dialogs belong to the
	 * previous one: they are dropped, so nothing on screen can act on the wrong employee while the new reads run.
	 */
	selectContext(organization: IOrganization, employee: IEmployee): void {
		const changed = this.selectedEmployee?.id !== employee.id || this.organization?.id !== organization.id;
		this.organization = organization;
		this.selectedEmployee = employee;
		if (changed) {
			this.rows = [];
			this.availableRows = [];
			this.searchTerm = '';
			this._removeRef?.close(false);
			this._assignRef?.close();
		}
	}

	/** The employee and organization shown now, or null before both are known. */
	private currentContext(): IMembershipContext | null {
		return this.selectedEmployee && this.organization
			? { employee: this.selectedEmployee, organization: this.organization }
			: null;
	}

	/** Whether the tab still shows the employee and organization a dialog was opened for. */
	private isCurrent(context: IMembershipContext): boolean {
		return context.employee.id === this.selectedEmployee?.id && context.organization.id === this.organization?.id;
	}

	/** The employee's display name, for captions and the remove confirmation. */
	get employeeName(): string {
		return nameOf(this.selectedEmployee);
	}

	/** Whether the user may open a contact's own page (the contacts routes ask the same). */
	get canOpenContact(): boolean {
		return this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW);
	}

	/** Rows matching the search, by name, email or phone. */
	get visibleRows(): IEmployeeContactRow[] {
		return EditEmployeeContactComponent.search(this.rows, this.searchTerm);
	}

	/** The assign dialog's options matching its search, by name, email or phone. */
	get assignOptions(): IEmployeeContactRow[] {
		return EditEmployeeContactComponent.search(this.availableRows, this.assignSearch);
	}

	/** Whether every option the search shows is ticked. */
	get allOptionsSelected(): boolean {
		const options = this.assignOptions;
		return options.length > 0 && options.every((row) => this.assignSelection.has(row.id));
	}

	/** Opens the assign dialog with nothing ticked. */
	openAssign(): void {
		const context = this.currentContext();
		if (this._assignRef || !context) {
			return;
		}
		this.assignSearch = '';
		this.assignSelection = new Set();
		const ref = this._dialogService.open(this.assignDialog, {
			closeOnBackdropClick: true,
			closeOnEsc: true,
			autoFocus: false
		});
		this._assignRef = ref;
		this._assignContext = context;
		// Esc or the backdrop can close it while a save runs: forget it only if it is still the open one.
		ref.onClose.subscribe(() => {
			if (this._assignRef === ref) {
				this._assignRef = null;
				this._assignContext = null;
			}
		});
		// Ready to type: the search is where picking starts.
		setTimeout(() => document.getElementById('assignContactsSearch')?.focus());
	}

	closeAssign(): void {
		if (!this.saving) {
			this._assignRef?.close();
		}
	}

	toggleOption(id: string): void {
		const selection = new Set(this.assignSelection);
		if (selection.has(id)) {
			selection.delete(id);
		} else {
			selection.add(id);
		}
		this.assignSelection = selection;
	}

	/** Ticks every option the search shows, or unticks them when they all are. */
	toggleAllOptions(): void {
		const selection = new Set(this.assignSelection);
		const options = this.assignOptions;
		const select = !this.allOptionsSelected;
		options.forEach((row) => (select ? selection.add(row.id) : selection.delete(row.id)));
		this.assignSelection = selection;
	}

	clearSelection(): void {
		this.assignSelection = new Set();
	}

	clearSearch(): void {
		this.searchTerm = '';
	}

	/**
	 * Assigns the dialog's employee to the ticked contacts, then closes that dialog: if it was dismissed during
	 * the save and another opened since, the new one and its ticks are left alone.
	 */
	async assignSelected(): Promise<void> {
		const ids = [...this.assignSelection];
		const ref = this._assignRef;
		const context = this._assignContext;
		if (!ids.length || this.saving || !ref || !context || !this.isCurrent(context)) {
			return;
		}
		const done = await this.updateMembership(context, ids, [], 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_ADDED');
		if (done) {
			ref.close();
		}
	}

	/**
	 * Asks for confirmation in the remove dialog, then takes the employee it was opened for off the contact.
	 * Refused while the rows are loading (they may be another employee's), and dropped if the tab switched
	 * employee while the dialog was open.
	 */
	async remove(row: IEmployeeContactRow): Promise<void> {
		const context = this.currentContext();
		if (this.removingId || this.loading || !context) {
			return;
		}
		const dialog = this._dialogService.open(this.removeDialog, {
			context: row,
			closeOnBackdropClick: true,
			closeOnEsc: true,
			autoFocus: true
		});
		this._removeRef = dialog;
		const confirmed = (await firstValueFrom(dialog.onClose)) === true;
		if (this._removeRef === dialog) {
			this._removeRef = null;
		}
		if (!confirmed || !this.isCurrent(context)) {
			return;
		}
		this.removingId = row.id;
		await this.updateMembership(context, [], [row.id], 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_REMOVED');
		this.removingId = null;
	}

	/**
	 * Saves a change to the contacts of the context's employee, then reloads the table.
	 *
	 * @returns `true` when the server accepted the change.
	 */
	private async updateMembership(
		context: IMembershipContext,
		added: string[],
		removed: string[],
		successKey: string
	): Promise<boolean> {
		this.saving = true;
		try {
			await this._organizationContactService.updateByEmployee({
				addedEntityIds: added,
				removedEntityIds: removed,
				member: context.employee,
				organizationId: context.organization.id,
				tenantId: context.organization.tenantId
			});
			this._toastrService.success(successKey);
			return true;
		} catch (error) {
			this._toastrService.danger('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
			return false;
		} finally {
			this.saving = false;
			this.subject$.next(true);
		}
	}

	/**
	 * Loads the employee's contacts and every contact of the organization.
	 *
	 * Assignment comes from the employee's own list; the organization's list, read with its people and projects,
	 * fills in each row's details. The rest of the organization's contacts are what the assign dialog offers.
	 */
	private async loadContacts(): Promise<void> {
		const loadId = ++this._loadId;
		this.loading = true;
		const [employeeContacts, organizationContacts] = await Promise.all([
			this.getSelectedEmployeeContacts(),
			this.getOrganizationContacts()
		]);
		if (loadId !== this._loadId) {
			return;
		}

		const byId = new Map(organizationContacts.map((contact) => [contact.id, contact]));
		const assignedIds = new Set(employeeContacts.map((contact) => contact.id));

		this.rows = employeeContacts
			.map((contact) => this.toRow(byId.get(contact.id) || contact))
			.sort((a, b) => a.name.localeCompare(b.name));
		this.availableRows = organizationContacts
			.filter((contact) => !assignedIds.has(contact.id))
			.map((contact) => this.toRow(contact))
			.sort((a, b) => a.name.localeCompare(b.name));
		this.loading = false;
	}

	private toRow(contact: IOrganizationContact): IEmployeeContactRow {
		const name = contact.name || '';
		const people = (contact.members || [])
			.map((member) => personOf(member))
			.filter((person): person is IPersonChip => !!person);
		const projectNames = (contact.projects || [])
			.filter((project) => !project.isArchived)
			.map((project) => project.name)
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b));

		return {
			id: contact.id,
			name,
			imageUrl: contact.imageUrl || contact.image?.fullUrl || undefined,
			initials: initialsOf(name) || '?',
			color: EditEmployeeContactComponent.colorOf(name),
			email: contact.primaryEmail || undefined,
			phone: contact.primaryPhone || undefined,
			type: EditEmployeeContactComponent.typeOf(contact.contactType),
			projectNames,
			projectList: projectNames.join(', '),
			memberNames: people.map((person) => person.name).join(', '),
			memberCount: people.length
		};
	}

	/** Matches rows by name, email or phone. */
	private static search(rows: IEmployeeContactRow[], term: string): IEmployeeContactRow[] {
		const needle = term.trim().toLowerCase();
		if (!needle) {
			return rows;
		}
		return rows.filter((row) =>
			[row.name, row.email, row.phone].some((value) => !!value && value.toLowerCase().includes(needle))
		);
	}

	/** The type lozenge: its i18n key and tone. */
	private static typeOf(type?: ContactType): { key: string; tone: TypeTone } | null {
		switch (type) {
			case ContactType.CLIENT:
				return { key: `${T}.TYPE.CLIENT`, tone: 'info' };
			case ContactType.CUSTOMER:
				return { key: `${T}.TYPE.CUSTOMER`, tone: 'success' };
			case ContactType.LEAD:
				return { key: `${T}.TYPE.LEAD`, tone: 'warning' };
			default:
				return null;
		}
	}

	/** A stable hue from the contact's name, for avatars of contacts without a picture. */
	private static colorOf(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = (hash * 31 + name.charCodeAt(i)) | 0;
		}
		return `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;
	}

	/**
	 * Fetches the contacts the selected employee is assigned to.
	 *
	 * @returns The employee's contacts; empty when the read fails.
	 */
	private async getSelectedEmployeeContacts(): Promise<IOrganizationContact[]> {
		if (!this.organization || !this.selectedEmployee) {
			return [];
		}
		const { id: organizationId, tenantId } = this.organization;
		try {
			return await this._organizationContactService.getAllByEmployee(this.selectedEmployee.id, {
				organizationId,
				tenantId
			});
		} catch (error) {
			console.error('Error loading selected employee contacts:', error);
			this._errorHandlingService.handleError(error);
			return [];
		}
	}

	/**
	 * Fetches every contact of the organization, with its people and projects.
	 *
	 * @returns The organization's contacts; empty when the read fails.
	 */
	private async getOrganizationContacts(): Promise<IOrganizationContact[]> {
		if (!this.organization) {
			return [];
		}
		const { id: organizationId, tenantId } = this.organization;
		try {
			const { items = [] } = await this._organizationContactService.getAll(CONTACT_RELATIONS, {
				organizationId,
				tenantId
			});
			return items;
		} catch (error) {
			console.error('Error fetching organization contacts:', error);
			this._errorHandlingService.handleError(error);
			return [];
		}
	}

	/**
	 * Leaving the tab with a dialog open: close it rather than leave it on screen without its host. The remove
	 * dialog closes as cancelled, so the pending remove() ends without removing anything.
	 */
	ngOnDestroy(): void {
		this._removeRef?.close(false);
		this._assignRef?.close();
	}
}
