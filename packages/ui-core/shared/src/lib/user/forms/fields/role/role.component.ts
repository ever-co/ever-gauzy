import { Component, OnInit, OnDestroy, Input, forwardRef, EventEmitter, Output } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { filter, Observable, of as observableOf } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NbComponentSize } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IRole, IUser, RolesEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { RoleService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-role-form-field',
    templateUrl: './role.component.html',
    styleUrls: [],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => RoleFormFieldComponent),
            multi: true
        }
    ],
    standalone: false
})
export class RoleFormFieldComponent implements OnInit, OnDestroy {
	roles: IRole[] = [];
	roles$: Observable<IRole[]> = observableOf([]);
	onChange: any = () => {};
	onTouched: any = () => {};

	/**
	 * Getter & Setter for dynamic remove role from options
	 */
	private _excludes: RolesEnum[] = [];
	get excludes(): RolesEnum[] {
		return this._excludes;
	}
	@Input() set excludes(value: RolesEnum[]) {
		this._excludes = value || [];
		// The parent can resolve its excludes after the roles have loaded
		// (e.g. an async permission check), so re-filter what is already shown.
		this.applyExcludes();
	}

	/** Every tenant role as fetched, before `excludes` is applied. */
	private _allRoles: IRole[] = [];
	/** Set once `getAll()` has returned; until then no selection can be judged. */
	private _rolesLoaded = false;

	// ID attribute for the field and for attribute for the label
	private _id: string;
	get id(): string {
		return this._id;
	}
	@Input() set id(value: string) {
		this._id = value;
	}

	/*
	 * Getter & Setter for dynamic field size
	 */
	private _size: NbComponentSize = 'medium';
	get size(): NbComponentSize {
		return this._size;
	}
	@Input() set size(value: NbComponentSize) {
		this._size = value;
	}

	/*
	 * Getter & Setter for placeholder
	 */
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for label
	 */
	private _label: string;
	get label(): string {
		return this._label;
	}
	@Input() set label(value: string) {
		this._label = value;
	}

	/*
	 * Getter & Setter accessor for form control
	 */
	private _ctrl: FormControl = new FormControl();
	get ctrl(): FormControl {
		return this._ctrl;
	}
	@Input() set ctrl(value: FormControl) {
		this._ctrl = value;
	}

	private _role: IRole;
	set role(value: IRole) {
		this._role = value;
		this.onChange(value);
		this.onTouched(value);
	}
	get role(): IRole {
		return this._role;
	}

	/**
	 * Getter & Setter for internal [(NgModel)]
	 */
	private _roleId: string;
	get roleId(): string {
		return this._roleId;
	}
	set roleId(value: string) {
		this._roleId = value;
	}

	@Output()
	selectedChange = new EventEmitter<IRole>();

	constructor(private readonly store: Store, private readonly rolesService: RoleService) {}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap(() => void this.renderRoles()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * GET all tenant roles
	 * Excludes role if needed
	 */
	async renderRoles() {
		this._allRoles = (await this.rolesService.getAll()).items;
		this._rolesLoaded = true;
		this.applyExcludes();
	}

	/**
	 * Filters the fetched roles by `excludes`, and clears the selection if it
	 * points at a role that is no longer allowed. The selection is only checked
	 * once the roles have loaded: before that the list is empty, and every
	 * preselected role would look disallowed. `renderRoles()` re-runs this after
	 * loading, so the check still happens then.
	 */
	private applyExcludes(): void {
		this.roles = this._allRoles.filter((role: IRole) => !this.excludes.includes(role.name as RolesEnum));
		this.roles$ = observableOf(this.roles);

		if (this._rolesLoaded && this.roleId && !this.roles.some((role: IRole) => role.id === this.roleId)) {
			this.roleId = null;
			this.ctrl.setValue(null);
			this.role = null;
		}
	}

	/**
	 * Write Value
	 * @param value
	 */
	writeValue(value: IRole) {
		if (value) {
			this.roleId = value.id;
		}
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 * On Selection Change
	 * @param role
	 */
	onSelectionChange(roleId: IRole['id']) {
		if (roleId) {
			this.role = this.getRoleById(roleId);
			if (this.role) {
				this.selectedChange.emit(this.role);
			}
		}
	}

	/**
	 * GET role by ID
	 *
	 * @param value
	 * @returns
	 */
	getRoleById(value: IRole['id']) {
		return this.roles.find((role: IRole) => value === role.id);
	}

	ngOnDestroy() {}
}
