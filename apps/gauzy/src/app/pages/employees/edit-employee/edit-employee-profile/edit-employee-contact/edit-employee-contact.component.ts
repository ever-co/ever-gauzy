import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
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
import { initialsOf, nameOf } from '../../../../projects/components/project-view/project-view.utils';

/** Relations the table reads for the employee's contacts: their projects. */
const CONTACT_RELATIONS: string[] = ['projects'];

/** Contacts per page in the assign dialog. */
const OPTIONS_PAGE_SIZE = 30;

/** Contacts per request for the table's details: the API's own limit. */
const DETAILS_PAGE_SIZE = 100;

/** How close to the end of the assign list, in pixels, the next page starts loading. */
const LOAD_MORE_THRESHOLD = 48;

/** Quiet time after typing in the assign dialog's search before the server is asked. */
const SEARCH_DEBOUNCE_MS = 300;

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
	/** The assign dialog's options: the pages read so far, less the contacts the employee already has. */
	public assignOptions: IEmployeeContactRow[] = [];
	public optionsLoading = false;
	public optionsFailed = false;
	/** Pages of options read, and how many contacts the search matches in all. */
	private _optionsPage = 0;
	private _optionsTotal = 0;
	/** Guards against an older page (or an older search's) landing after a newer one. */
	private _optionsRequest = 0;
	private readonly _assignSearch$ = new Subject<string>();
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
		// The assign dialog's search asks the server once typing pauses.
		this._assignSearch$
			.pipe(
				debounceTime(SEARCH_DEBOUNCE_MS),
				tap(() => this.loadOptions(true)),
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
			this.assignOptions = [];
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

	/**
	 * Whether the user may assign the employee to contacts or take them off one: choosing a contact
	 * (`GET /organization-contact/assignable`) and saving the change both take ORG_EMPLOYEES_EDIT.
	 */
	get canChangeContacts(): boolean {
		return this._store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT);
	}

	/** Whether the user may open a contact's own page (the contacts routes ask the same). */
	get canOpenContact(): boolean {
		return this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW);
	}

	/** Rows matching the search, by name, email or phone. */
	get visibleRows(): IEmployeeContactRow[] {
		return EditEmployeeContactComponent.search(this.rows, this.searchTerm);
	}

	/** Whether the search matches contacts beyond the pages read so far. */
	get hasMoreOptions(): boolean {
		return this._optionsPage * OPTIONS_PAGE_SIZE < this._optionsTotal;
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
		this.loadOptions(true);
		// Esc or the backdrop can close it while a save runs: forget it only if it is still the open one.
		ref.onClose.subscribe(() => {
			if (this._assignRef === ref) {
				this._assignRef = null;
				this._assignContext = null;
				this._optionsRequest++; // a page still on its way is no longer wanted
			}
		});
		// Ready to type: the search is where picking starts.
		setTimeout(() => document.getElementById('assignContactsSearch')?.focus());
	}

	/** The assign dialog's search: the server is asked once typing pauses. */
	onAssignSearch(term: string): void {
		this.assignSearch = term;
		this._assignSearch$.next(term);
	}

	/** Reads the next page when the list is scrolled near its end. */
	onOptionsScroll(event: Event): void {
		const list = event.target as HTMLElement;
		if (list.scrollTop + list.clientHeight >= list.scrollHeight - LOAD_MORE_THRESHOLD) {
			this.loadMoreOptions();
		}
	}

	loadMoreOptions(): void {
		if (!this.optionsLoading && !this.optionsFailed && this.hasMoreOptions) {
			this.loadOptions(false);
		}
	}

	/** Asks again for the page that failed: the first one, or the next. */
	retryOptions(): void {
		this.loadOptions(this._optionsPage === 0);
	}

	/**
	 * Reads a page of the contacts the employee can be assigned to, matching the dialog's search by name, and adds the
	 * ones the employee does not have yet. `reset` starts again from the first page (on opening, or a new search).
	 * A page made only of contacts the employee already has shows nothing new, so reading goes on until the list
	 * holds a page's worth or the contacts run out.
	 */
	async loadOptions(reset: boolean): Promise<void> {
		const context = this._assignContext;
		if (!context) {
			return;
		}
		if (reset) {
			this._optionsPage = 0;
			this._optionsTotal = 0;
			this.assignOptions = [];
		}
		const request = ++this._optionsRequest;
		const term = this.assignSearch.trim();
		const { id: organizationId, tenantId } = context.organization;
		this.optionsLoading = true;
		this.optionsFailed = false;
		try {
			// The assignable list: id, name, picture and type, under ORG_EMPLOYEES_EDIT (as assigning is), ordered by
			// name then id, so contacts sharing a name keep their place across pages.
			const { items = [], total = 0 } = await this._organizationContactService.getAssignable({
				organizationId,
				tenantId,
				...(term ? { name: term } : {}),
				take: OPTIONS_PAGE_SIZE,
				skip: this._optionsPage + 1
			});
			if (request !== this._optionsRequest) {
				return;
			}
			const assigned = new Set(this.rows.map((row) => row.id));
			const shown = new Set(this.assignOptions.map((row) => row.id));
			this._optionsPage += 1;
			this._optionsTotal = total;
			this.assignOptions = [
				...this.assignOptions,
				...items
					.filter((contact) => !assigned.has(contact.id) && !shown.has(contact.id))
					.map((contact) => this.toRow(contact as IOrganizationContact))
			];
		} catch (error) {
			if (request === this._optionsRequest) {
				console.error('Error loading contacts to assign:', error);
				this.optionsFailed = true;
			}
			return;
		} finally {
			if (request === this._optionsRequest) {
				this.optionsLoading = false;
			}
		}
		if (this.hasMoreOptions && this.assignOptions.length < OPTIONS_PAGE_SIZE) {
			await this.loadOptions(false);
		}
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
	 * Loads the employee's contacts: which ones from the employee's own list, and their details (type, email, phone,
	 * projects) from the contacts of that employee alone. The organization's other contacts are read only by the
	 * assign dialog, a page at a time.
	 */
	private async loadContacts(): Promise<void> {
		const loadId = ++this._loadId;
		this.loading = true;
		const employeeContacts = await this.getSelectedEmployeeContacts();
		const details = employeeContacts.length ? await this.getContactDetails(employeeContacts.length) : [];
		if (loadId !== this._loadId) {
			return;
		}

		const byId = new Map(details.map((contact) => [contact.id, contact]));
		this.rows = employeeContacts
			.map((contact) => this.toRow(byId.get(contact.id) || contact))
			.sort((a, b) => a.name.localeCompare(b.name));
		this.loading = false;
	}

	private toRow(contact: IOrganizationContact): IEmployeeContactRow {
		const name = contact.name || '';
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
			projectList: projectNames.join(', ')
		};
	}

	/** Matches rows by name, email or phone (the table's search). */
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
	 * Fetches the details of the selected employee's contacts, with their projects: only that employee's, a page
	 * of up to 100 per request. Reading contacts takes ORG_CONTACT_VIEW; without it the rows keep the name and
	 * picture the employee's own list gives.
	 *
	 * @param count How many contacts the employee has.
	 * @returns The employee's contacts with their details; empty without the permission, or when the read fails.
	 */
	private async getContactDetails(count: number): Promise<IOrganizationContact[]> {
		if (!this.organization || !this.selectedEmployee || !this._store.hasPermission(PermissionsEnum.ORG_CONTACT_VIEW)) {
			return [];
		}
		const { id: organizationId, tenantId } = this.organization;
		const employeeId = this.selectedEmployee.id;
		const pages = Math.ceil(count / DETAILS_PAGE_SIZE);
		try {
			const results = await Promise.all(
				Array.from({ length: pages }, (_, page) =>
					this._organizationContactService.pagination({
						where: { organizationId, tenantId, members: [employeeId] },
						relations: CONTACT_RELATIONS,
						// The id breaks ties between contacts sharing a name, so none crosses a page boundary twice.
						order: { name: 'ASC', id: 'ASC' },
						take: DETAILS_PAGE_SIZE,
						skip: page + 1
					})
				)
			);
			return results.flatMap((result) => result.items || []);
		} catch (error) {
			console.error('Error loading the employee contacts details:', error);
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
