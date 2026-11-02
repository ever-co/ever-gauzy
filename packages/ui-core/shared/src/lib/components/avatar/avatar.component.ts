import { Component, Input, OnInit, ChangeDetectionStrategy, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeKindEnum, ID, IEmployee, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

const AGENT_BADGE_KEY = 'EMPLOYEES_PAGE.AGENT_BADGE';

/**
 * The agent badge label: the translation of `EMPLOYEES_PAGE.AGENT_BADGE`, or `Agent` while it is not loaded
 * (or without a translation service).
 */
export function agentBadgeLabel(translate?: TranslateService): Observable<string> {
	if (!translate) {
		return of('Agent');
	}
	return translate
		.stream(AGENT_BADGE_KEY)
		.pipe(map((translated: string) => (translated && translated !== AGENT_BADGE_KEY ? translated : 'Agent')));
}

@Component({
    selector: 'ngx-avatar',
    templateUrl: './avatar.component.html',
    styleUrls: ['./avatar.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AvatarComponent implements OnInit {
	public online$: Observable<boolean>;

	@Input() size: 'lg' | 'sm' | 'md' = 'md';
	@Input() src: string;
	@Input() appendCaption: string;
	@Input() caption: string;
	@Input() id: ID;
	@Input() isOption: boolean;
	/** Which employee page a click opens: the edit form (default) or the read-only profile view. */
	@Input() linkTo: 'edit' | 'view' = 'edit';

	/**
	 * A class member and getter/setter for managing an employee object.
	 */
	private _employee = new BehaviorSubject<any>(null);
	@Input() set employee(value: IEmployee) {
		this._employee.next(value);
	}
	get employee(): IEmployee {
		return this._employee.getValue();
	}

	// Added for set component value when used for angular2-smart-table renderer.
	@Input() set value(object: any) {
		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				this[key] = object[key];
			}
		}
	}

	/**
	 * A class member and getter/setter for managing an employee name.
	 */
	private _name: string;
	@Input() set name(value: string) {
		this._name = value;
	}
	get name(): string {
		return this._name;
	}

	constructor(
		private readonly router: Router,
		private readonly store: Store,
		@Optional() private readonly translate?: TranslateService
	) {
		this.agentLabel$ = agentBadgeLabel(translate);
	}

	/** Whether the employee is an agent employee (`kind = 'agent'`, e.g. an Ever Works agent). */
	get isAgent(): boolean {
		return this.employee?.kind === EmployeeKindEnum.AGENT;
	}

	/**
	 * The label of the agent badge, translated when a translation service is available. A stream, created
	 * once per avatar: it follows the language and the translation file loading, instead of an `instant`
	 * lookup on every change-detection pass that answers the key while the file is still loading.
	 */
	public readonly agentLabel$: Observable<string>;

	ngOnInit() {
		if (this._employee) {
			this.online$ = this._employee
				.asObservable()
				.pipe(map((employee) => employee?.isOnline && !employee?.isAway));
		}
	}

	/**
	 * Navigates to the employee edit page (or the profile view, per `linkTo`) for the provided employee ID.
	 *
	 * @param id - The ID of the employee to open.
	 */
	edit(id: ID): void {
		const page = this.resolveLinkTo(id);
		if (id && page) {
			this.router.navigate([`/pages/employees/${page}/${id}`]);
		}
	}

	/**
	 * The employee page the current user may open for `id`. The profile view requires `ORG_EMPLOYEES_VIEW`,
	 * which the default EMPLOYEE role does not have: without it, a `'view'` link falls back to the edit form
	 * for the user's own employee (`PROFILE_EDIT`) or for anyone (`ORG_EMPLOYEES_EDIT`), and to nothing otherwise.
	 */
	private resolveLinkTo(id: ID): 'edit' | 'view' | null {
		if (this.linkTo === 'edit' || this.store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_VIEW)) {
			return this.linkTo;
		}
		if (this.store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)) {
			return 'edit';
		}
		const isOwnEmployee = !!id && id === this.store.user?.employee?.id;
		return isOwnEmployee && this.store.hasPermission(PermissionsEnum.PROFILE_EDIT) ? 'edit' : null;
	}
}
