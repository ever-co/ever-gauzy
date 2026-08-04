import { Component, Input, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@gauzy/ui-config';
import { IEmployee, IUser, IEmployeeUpdateInput } from '@gauzy/contracts';
import { EmployeesService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { BehaviorSubject, tap, Observable, filter, firstValueFrom } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-user-menu',
    templateUrl: './user-menu.component.html',
    styleUrls: ['./user-menu.component.scss'],
    standalone: false
})
export class UserMenuComponent implements OnInit, OnDestroy {
	private _user$: Observable<IUser>;
	private _employee$: BehaviorSubject<IEmployee>;
	private _isSubmit$: BehaviorSubject<boolean>;
	platFormWebSiteUrl: string;

	@Output()
	public close: EventEmitter<any> = new EventEmitter<any>(null);

	/**
	 * Whether an outside click is allowed to close this panel yet. Same reason
	 * as `gauzy-workspace-menu`: `gauzyOutside` listens on `document`, so arming
	 * has to be deferred past the click that opened the panel. This replaces a
	 * counter that required TWO outside clicks to dismiss — the first was
	 * swallowed by the panel (576x288 over the lower-left of the page) and did
	 * nothing at all, which is one of the "clicks do nothing" reports.
	 */
	private armed = false;
	private armTimer: ReturnType<typeof setTimeout> | undefined;

	public downloadApps = [
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_APPLE,
			icon: 'fab fa-apple'
		},
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_WINDOWS,
			icon: 'fa-brands fa-windows'
		},
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_LINUX,
			icon: 'fa-brands fa-linux'
		},
		{
			link: environment.MOBILE_APP_DOWNLOAD_LINK,
			icon: 'fas fa-mobile'
		},
		{
			link: environment.EXTENSION_DOWNLOAD_LINK,
			icon: 'fa-brands fa-chrome'
		}
	];

	constructor(
		private readonly _employeeService: EmployeesService,
		private readonly _errorHandler: ErrorHandlingService
	) {
		this._user$ = new Observable();
		this._employee$ = new BehaviorSubject(null);
		this._isSubmit$ = new BehaviorSubject(false);
		this.platFormWebSiteUrl = environment.PLATFORM_WEBSITE_URL;
	}

	ngOnInit(): void {
		this.armTimer = setTimeout(() => (this.armed = true));

		this.user$
			.pipe(
				distinctUntilChange(),
				filter(({ employee }) => !!employee),
				tap(async (user: IUser) => {
					this._isSubmit$.next(true);
					const employee = await firstValueFrom(this._employeeService.getEmployeeById(user?.employee?.id));
					this._employee$.next(employee);
					this._isSubmit$.next(false);
				}),

				untilDestroyed(this)
			)
			.subscribe();
	}

	public onClick() {
		this.close.emit();
	}

	public onClickOutside(clickedInside: boolean) {
		if (!clickedInside && this.armed) {
			this.onClick();
		}
	}

	ngOnDestroy(): void {
		clearTimeout(this.armTimer);
	}

	public async onChangeStatus(): Promise<void> {
		try {
			if (!this.employee) {
				return;
			}
			this._isSubmit$.next(true);
			const { id, isAway, tenantId, organizationId } = this.employee;
			const payload: IEmployeeUpdateInput = {
				isAway: !isAway,
				tenantId,
				organizationId
			};
			await this._employeeService.updateProfile(id, payload);
			this._employee$.next({ ...this.employee, ...payload });
		} catch (error) {
			this._errorHandler.handleError(error);
		}
		this._isSubmit$.next(false);
	}

	public get employee(): IEmployee {
		return this._employee$.getValue();
	}

	public get employee$(): Observable<IEmployee> {
		return this._employee$.asObservable();
	}

	@Input()
	public set user$(value: Observable<IUser>) {
		if (value) {
			this._user$ = value;
		}
	}

	public get user$(): Observable<IUser> {
		return this._user$;
	}

	public get isSubmit$(): Observable<boolean> {
		return this._isSubmit$.asObservable();
	}
}
