import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	EventEmitter,
	Output
} from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { filter, map, Observable, of as observableOf } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NbComponentSize } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IRole, IUser, RolesEnum } from '@gauzy/contracts';
import { RoleService, Store } from './../../../../../@core/services';

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
	]
})
export class RoleFormFieldComponent implements OnInit, OnDestroy {

	roles: IRole[] = [];
	roles$: Observable<IRole[]> = observableOf([]);

	/**
	 * Getter & Setter for dynamic remove role from options
	 */
	private _excludes: RolesEnum[] = [];
	get excludes(): RolesEnum[] {
		return this._excludes;
	}
	@Input() set excludes(value: RolesEnum[]) {
		this._excludes = value;
	}

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
	
	onChange: any = () => {};
	onTouched: any = () => {};

	private _role: IRole;
	set role(val: IRole) {
		this._role = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get role(): IRole {
		return this._role;
	}

	@Output()
	selectedChange = new EventEmitter<IRole>();

	constructor(
		private readonly store: Store,
		private readonly rolesService: RoleService
	) {}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap(() => this.renderRoles()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	* GET all tenant roles
	* Excludes role if needed
	*/
	async renderRoles() {
		this.roles$ = observableOf((await (this.rolesService.getAll())).items ).pipe(
			map((roles: IRole[]) => roles.filter(
				(role: IRole) => !this.excludes.includes(role.name as RolesEnum)
			)),
			tap((roles: IRole[]) => this.roles = roles)
		);
	}

	writeValue(value: IRole) {
		if (value) {
			this.role = value;
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
	onSelectionChange(role: IRole) {
		if (role) {
			this.role = role;
			this.selectedChange.emit(role);
		}
	}

	ngOnDestroy() {}
}
