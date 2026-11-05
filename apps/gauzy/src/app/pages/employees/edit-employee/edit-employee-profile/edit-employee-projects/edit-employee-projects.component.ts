import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import {
	IEmployee,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectEmployee,
	PermissionsEnum,
	ProjectBillingEnum,
	ProjectStatusEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	EmployeeStore,
	ErrorHandlingService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	IProjectQuickLookCard,
	IProjectQuickLookPerson
} from '../../../../projects/components/project-quick-look/project-quick-look.component';
import { managesProject } from '../../../../projects/components/project-quick-look/project-view-sections';
import { initialsOf, IPersonChip, nameOf, personOf } from '../../../../projects/components/project-view/project-view.utils';

/** Relations the table reads from the organization's projects: people, their roles and the client. */
const PROJECT_RELATIONS: string[] = ['members.employee.user', 'members.role', 'organizationContact'];

/** Avatars drawn in the Members column before the rest fold into "+N". */
const VISIBLE_MEMBERS = 4;

/** i18n prefix of the tab's own strings. */
const T = 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PROJECTS_TAB';

type StatusTone = 'basic' | 'info' | 'success' | 'danger';

/** One row of the employee's projects table. */
export interface IEmployeeProjectRow {
	id: string;
	name: string;
	imageUrl?: string;
	initials: string;
	/** The logo tint: the project's own colour, else one derived from its name. */
	color: string;
	code?: string;
	client?: string;
	isPublic: boolean;
	status: { key: string; tone: StatusTone } | null;
	/** Whether this employee manages the project (flag or MANAGER role). */
	isManager: boolean;
	billingKey: string | null;
	currency?: string;
	members: IPersonChip[];
	/** Members beyond the visible avatars. */
	moreMembers: number;
	/** Every member's name, for the stack's tooltip. */
	memberNames: string;
	/** How many people are on the project. */
	memberCount: number;
}

/** Whose memberships a dialog changes: fixed when it opens, so a later switch of employee cannot redirect it. */
interface IMembershipContext {
	employee: IEmployee;
	organization: IOrganization;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-projects',
	templateUrl: './edit-employee-projects.component.html',
	styleUrls: ['./edit-employee-projects.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditEmployeeProjectsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	/** The remove confirmation; its context is the row being removed. */
	@ViewChild('removeDialog', { static: true }) readonly removeDialog: TemplateRef<IEmployeeProjectRow>;
	/** The assign dialog: a searchable checklist of the projects the employee is not in yet. */
	@ViewChild('assignDialog', { static: true }) readonly assignDialog: TemplateRef<void>;
	private _assignRef: NbDialogRef<void> | null = null;
	/** The employee and organization the open assign dialog was opened for. */
	private _assignContext: IMembershipContext | null = null;
	private _removeRef: NbDialogRef<IEmployeeProjectRow> | null = null;

	private subject$: Subject<boolean> = new Subject();
	/** Guards against an older read landing after a newer one. */
	private _loadId = 0;

	public readonly T = T;
	public rows: IEmployeeProjectRow[] = [];
	/** The organization's projects the employee is not a member of: what the assign dialog offers. */
	public availableRows: IEmployeeProjectRow[] = [];
	public selectedEmployee: IEmployee;
	public organization: IOrganization;

	public loading = false;
	public saving = false;
	public removingId: string | null = null;
	public searchTerm = '';
	public assignSearch = '';
	public assignSelection = new Set<string>();

	/** The project open in the quick-look drawer. */
	public viewedProject: IProjectQuickLookCard | null = null;
	public people: IProjectQuickLookPerson[] = [];
	public readonly rangeStart: string;
	public readonly rangeEnd: string;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _toastrService: ToastrService,
		private readonly _employeeStore: EmployeeStore,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _dialogService: NbDialogService
	) {
		super(translateService);
		// The quick look reports on this month, as the employee page does by default.
		const now = new Date();
		this.rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
		this.rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
	}

	ngOnInit() {
		this.subject$
			.pipe(
				tap(() => this.loadProjects()),
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
		const person = personOf(employee);
		this.people = person ? [{ ...person, id: employee.id }] : [];
		this.viewedProject = null;
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

	/** Rows matching the search, by name, key or client. */
	get visibleRows(): IEmployeeProjectRow[] {
		const term = this.searchTerm.trim().toLowerCase();
		if (!term) {
			return this.rows;
		}
		return this.rows.filter((row) =>
			[row.name, row.code, row.client].some((value) => !!value && value.toLowerCase().includes(term))
		);
	}

	/** The assign dialog's options matching its search, by name, key or client. */
	get assignOptions(): IEmployeeProjectRow[] {
		const term = this.assignSearch.trim().toLowerCase();
		if (!term) {
			return this.availableRows;
		}
		return this.availableRows.filter((row) =>
			[row.name, row.code, row.client].some((value) => !!value && value.toLowerCase().includes(term))
		);
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
		setTimeout(() => document.getElementById('assignProjectsSearch')?.focus());
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

	trackById(_: number, item: { id: string }): string {
		return item.id;
	}

	/**
	 * Adds the dialog's employee to the ticked projects, then closes that dialog: if it was dismissed during
	 * the save and another opened since, the new one and its ticks are left alone.
	 */
	async assignSelected(): Promise<void> {
		const ids = [...this.assignSelection];
		const ref = this._assignRef;
		const context = this._assignContext;
		if (!ids.length || this.saving || !ref || !context || !this.isCurrent(context)) {
			return;
		}
		const done = await this.updateMembership(context, ids, [], 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_ADDED');
		if (done) {
			ref.close();
		}
	}

	/**
	 * Asks for confirmation in the remove dialog, then takes the employee it was opened for off the project.
	 * Refused while the rows are loading (they may be another employee's), and dropped if the tab switched
	 * employee while the dialog was open.
	 */
	async remove(row: IEmployeeProjectRow): Promise<void> {
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
		const done = await this.updateMembership(context, [], [row.id], 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_REMOVED');
		this.removingId = null;
		if (done && this.viewedProject?.id === row.id) {
			this.closeProject();
		}
	}

	openProject(row: IEmployeeProjectRow): void {
		this.viewedProject = { id: row.id, name: row.name, imageUrl: row.imageUrl, initials: row.initials };
	}

	closeProject(): void {
		this.viewedProject = null;
	}

	/**
	 * Saves a change to the project memberships of the context's employee, then reloads the table.
	 *
	 * @returns `true` when the server accepted the change.
	 */
	private async updateMembership(
		context: IMembershipContext,
		added: string[],
		removed: string[],
		successKey: string
	): Promise<boolean> {
		const { id: organizationId, tenantId } = context.organization;
		this.saving = true;
		try {
			await this._organizationProjectsService.updateByEmployee({
				addedProjectIds: added,
				removedProjectIds: removed,
				member: context.employee,
				organizationId,
				tenantId
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
	 * Loads the employee's projects and every project of the organization.
	 *
	 * Membership comes from the employee's own list (it leaves out archived projects and former members);
	 * the organization's list, read with members and client, fills in each row's details. The rest of the
	 * organization's projects are what the assign dialog offers.
	 */
	private async loadProjects(): Promise<void> {
		const loadId = ++this._loadId;
		this.loading = true;
		const [employeeProjects, organizationProjects] = await Promise.all([
			this.getSelectedEmployeeProjects(),
			this.getOrganizationProjects()
		]);
		if (loadId !== this._loadId) {
			return;
		}

		const byId = new Map(organizationProjects.map((project) => [project.id, project]));
		const assignedIds = new Set(employeeProjects.map((project) => project.id));

		this.rows = employeeProjects
			.map((project) => this.toRow(byId.get(project.id) || project))
			.sort((a, b) => a.name.localeCompare(b.name));
		this.availableRows = organizationProjects
			.filter((project) => !assignedIds.has(project.id))
			.map((project) => this.toRow(project))
			.sort((a, b) => a.name.localeCompare(b.name));
		this.loading = false;
	}

	private toRow(project: IOrganizationProject): IEmployeeProjectRow {
		const name = project.name || '';
		const members = (project.members || []).filter(
			(member: IOrganizationProjectEmployee) => !!member?.employee && member.isActive !== false && !member.isArchived
		);
		const people = members
			.map((member) => personOf(member.employee))
			.filter((person): person is IPersonChip => !!person);
		const self = members.find((member) => member.employeeId === this.selectedEmployee?.id);

		return {
			id: project.id,
			name,
			imageUrl: project.imageUrl || undefined,
			initials: initialsOf(name) || '?',
			color: project.color || EditEmployeeProjectsComponent.colorOf(name),
			code: project.code || undefined,
			client: project.organizationContact?.name || undefined,
			isPublic: !!project.public,
			status: EditEmployeeProjectsComponent.statusOf(project.status),
			isManager: !!self && managesProject(self),
			billingKey: EditEmployeeProjectsComponent.billingKeyOf(project.billing),
			currency: project.currency || undefined,
			members: people.slice(0, VISIBLE_MEMBERS),
			moreMembers: Math.max(people.length - VISIBLE_MEMBERS, 0),
			memberNames: people.map((person) => person.name).join(', '),
			memberCount: people.length
		};
	}

	/** The status lozenge: its i18n key and tone. */
	private static statusOf(status?: string): { key: string; tone: StatusTone } | null {
		switch (status) {
			case ProjectStatusEnum.OPEN:
				return { key: `${T}.STATUS.OPEN`, tone: 'basic' };
			case ProjectStatusEnum.IN_PROGRESS:
				return { key: `${T}.STATUS.IN_PROGRESS`, tone: 'info' };
			case ProjectStatusEnum.COMPLETED:
				return { key: `${T}.STATUS.COMPLETED`, tone: 'success' };
			case ProjectStatusEnum.CANCELLED:
				return { key: `${T}.STATUS.CANCELLED`, tone: 'danger' };
			case ProjectStatusEnum.CUSTOM:
				return { key: `${T}.STATUS.CUSTOM`, tone: 'basic' };
			default:
				return null;
		}
	}

	private static billingKeyOf(billing?: ProjectBillingEnum): string | null {
		return billing && Object.values(ProjectBillingEnum).includes(billing) ? `${T}.BILLING.${billing}` : null;
	}

	/** A stable hue from the project's name, for logos of projects without a colour of their own. */
	private static colorOf(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = (hash * 31 + name.charCodeAt(i)) | 0;
		}
		return `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;
	}

	/**
	 * Fetches projects assigned to the selected employee.
	 *
	 * @returns The employee's projects; empty without the permission, or when the read fails.
	 */
	private async getSelectedEmployeeProjects(): Promise<IOrganizationProject[]> {
		if (!this.canViewProjects()) {
			return [];
		}
		const { id: organizationId, tenantId } = this.organization;
		try {
			return await this._organizationProjectsService.getAllByEmployee(this.selectedEmployee.id, {
				organizationId,
				tenantId
			});
		} catch (error) {
			console.error('Error loading selected employee projects:', error);
			this._errorHandlingService.handleError(error);
			return [];
		}
	}

	/**
	 * Fetches every project of the organization, with members and client.
	 *
	 * @returns The organization's projects; empty without the permission, or when the read fails.
	 */
	private async getOrganizationProjects(): Promise<IOrganizationProject[]> {
		if (!this.canViewProjects()) {
			return [];
		}
		const { id: organizationId, tenantId } = this.organization;
		try {
			const { items = [] } = await this._organizationProjectsService.getAll(PROJECT_RELATIONS, {
				organizationId,
				tenantId
			});
			return items;
		} catch (error) {
			console.error('Error fetching organization projects:', error);
			this._errorHandlingService.handleError(error);
			return [];
		}
	}

	private canViewProjects(): boolean {
		return (
			!!this.organization &&
			!!this.selectedEmployee &&
			this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		);
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
