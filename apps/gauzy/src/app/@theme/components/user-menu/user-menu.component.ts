import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { IEmployee, IUser, IEmployeeUpdateInput } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { BehaviorSubject, tap, Observable, filter, firstValueFrom } from 'rxjs';
import { EmployeesService, ErrorHandlingService } from '../../../@core';
import { environment } from '@env/environment';
import { JitsuService } from '../../../@core/services/analytics/jitsu.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-user-menu',
	templateUrl: './user-menu.component.html',
	styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent implements OnInit {
	private _user$: Observable<IUser>;
	private _employee$: BehaviorSubject<IEmployee>;
	private _isSubmit$: BehaviorSubject<boolean>;

	@Output()
	public close: EventEmitter<any> = new EventEmitter<any>(null);

	public clicks: boolean[] = [];

	public downloadApps = [
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_APPLE,
			icon: 'fab fa-apple',
		},
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_WINDOWS,
			icon: 'fa-brands fa-windows',
		},
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_LINUX,
			icon: 'fa-brands fa-linux',
		},
		{
			link: environment.MOBILE_APP_DOWNLOAD_LINK,
			icon: 'fas fa-mobile',
		},
		{
			link: environment.EXTENSION_DOWNLOAD_LINK,
			icon: 'fa-brands fa-chrome',
		},
	];

	constructor(
		private readonly _employeeService: EmployeesService,
		private readonly _errorHandler: ErrorHandlingService,
		private readonly jitsuService: JitsuService
	) {
		this._user$ = new Observable();
		this._employee$ = new BehaviorSubject(null);
		this._isSubmit$ = new BehaviorSubject(false);
	}

	ngOnInit(): void {
		this.user$
			.pipe(
				distinctUntilChange(),
				filter(({ employee }) => !!employee),
				tap(async (user: IUser) => {
					this._isSubmit$.next(true);
					const employee = await firstValueFrom(
						this._employeeService.getEmployeeById(user.employeeId)
					);
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

	public onClickOutside(event: boolean) {
		this.clicks.push(event);
		if (!event && this.clicks.length > 1) this.onClick();
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
				organizationId,
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
