import { Component, HostListener, Input, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@gauzy/ui-config';
import { IEmployee, IUser, IEmployeeUpdateInput } from '@gauzy/contracts';
import { EmployeesService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	BehaviorSubject,
	tap,
	Observable,
	filter,
	firstValueFrom,
	combineLatest,
	map,
	distinctUntilChanged
} from 'rxjs';

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
	/**
	 * The employee lookup and the status update run independently — a user or
	 * organization switch can start a lookup while `onChangeStatus()` is still
	 * waiting on the server — so each keeps its own in-flight flag. With a single
	 * shared flag, whichever request settled first re-enabled the status control
	 * while the other was still running.
	 */
	private _isLoadingEmployee$: BehaviorSubject<boolean>;
	private _isUpdatingStatus$: BehaviorSubject<boolean>;
	private _isSubmit$: Observable<boolean>;
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

	private clickedInOverlay = false;

	/**
	 * Identifies the employee lookup currently in flight. The panel can stay open
	 * across a user or organization switch, so a slow earlier request can settle
	 * after a newer one; anything that no longer matches this counter is stale and
	 * must not touch the employee or the loading state.
	 */
	private lookupId = 0;

	@HostListener('document:click', ['$event.target'])
	public trackOverlayClick(target: EventTarget | null): void {
		this.clickedInOverlay = target instanceof Element && !!target.closest('.cdk-overlay-container');
	}

	/**
	 * Each entry carries a `label` translation key because the anchors render an
	 * icon only — without it a screen reader announces five identical links.
	 */
	public downloadApps = [
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_APPLE,
			icon: 'fab fa-apple',
			label: 'USER_MENU.DOWNLOAD_MACOS'
		},
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_WINDOWS,
			icon: 'fa-brands fa-windows',
			label: 'USER_MENU.DOWNLOAD_WINDOWS'
		},
		{
			link: environment.DESKTOP_APP_DOWNLOAD_LINK_LINUX,
			icon: 'fa-brands fa-linux',
			label: 'USER_MENU.DOWNLOAD_LINUX'
		},
		{
			link: environment.MOBILE_APP_DOWNLOAD_LINK,
			icon: 'fas fa-mobile',
			label: 'USER_MENU.DOWNLOAD_MOBILE'
		},
		{
			link: environment.EXTENSION_DOWNLOAD_LINK,
			icon: 'fa-brands fa-chrome',
			label: 'USER_MENU.DOWNLOAD_BROWSER_EXTENSION'
		}
	];

	constructor(
		private readonly _employeeService: EmployeesService,
		private readonly _errorHandler: ErrorHandlingService
	) {
		this._user$ = new Observable();
		this._employee$ = new BehaviorSubject(null);
		this._isLoadingEmployee$ = new BehaviorSubject(false);
		this._isUpdatingStatus$ = new BehaviorSubject(false);
		this._isSubmit$ = combineLatest([this._isLoadingEmployee$, this._isUpdatingStatus$]).pipe(
			map(([isLoadingEmployee, isUpdatingStatus]) => isLoadingEmployee || isUpdatingStatus),
			distinctUntilChanged()
		);
		this.platFormWebSiteUrl = environment.PLATFORM_WEBSITE_URL;
	}

	ngOnInit(): void {
		this.armTimer = setTimeout(() => (this.armed = true));

		this.user$
			.pipe(
				distinctUntilChange(),
				tap((user: IUser) => {
					// A user without an employee still has to invalidate the lookup in
					// flight: the filter below drops the emission, so without this an
					// earlier request could settle afterwards and repopulate the menu with
					// the previous employee, letting onChangeStatus() update that record.
					if (!user?.employee) {
						this.lookupId++;
						this._employee$.next(null);
						this._isLoadingEmployee$.next(false);
					}
				}),
				filter((user: IUser) => !!user?.employee),
				tap(async (user: IUser) => {
					const employeeId = user.employee.id;
					const lookupId = ++this.lookupId;
					this._isLoadingEmployee$.next(true);
					try {
						const employee = await firstValueFrom(this._employeeService.getEmployeeById(employeeId));
						if (lookupId !== this.lookupId) {
							return;
						}
						this._employee$.next(employee);
					} catch (error) {
						// A superseded lookup owns nothing on screen any more: neither its
						// failure nor its error message belongs to the employee now shown.
						if (lookupId !== this.lookupId) {
							return;
						}
						// Clear the cached employee only when it belongs to someone else:
						// keeping a stale employee would let onChangeStatus() write the away
						// flag to the wrong one, while a failed refresh of the same employee
						// should leave the status control on the data it already has.
						if (this.employee?.id !== employeeId) {
							this._employee$.next(null);
						}
						this._errorHandler.handleError(error);
					} finally {
						// Always release the loading state, otherwise a failed load leaves
						// the status control stuck behind a spinner for the whole session.
						// A superseded lookup leaves it to the newer one still running.
						if (lookupId === this.lookupId) {
							this._isLoadingEmployee$.next(false);
						}
					}
				}),

				untilDestroyed(this)
			)
			.subscribe();
	}

	public onClick() {
		this.close.emit();
	}

	public onClickOutside(clickedInside: boolean) {
		if (!clickedInside && !this.clickedInOverlay && this.armed) {
			this.onClick();
		}
	}

	ngOnDestroy(): void {
		clearTimeout(this.armTimer);
	}

	public async onChangeStatus(): Promise<void> {
		// Guard against a second activation while a request is already in flight:
		// the disabled attribute covers pointer and keyboard, this covers the rest.
		// A lookup in flight counts too — the employee on screen is about to change.
		if (!this.employee || this._isLoadingEmployee$.getValue() || this._isUpdatingStatus$.getValue()) {
			return;
		}
		this._isUpdatingStatus$.next(true);
		try {
			const { id, isAway, tenantId, organizationId } = this.employee;
			const payload: IEmployeeUpdateInput = {
				isAway: !isAway,
				tenantId,
				organizationId
			};
			await this._employeeService.updateProfile(id, payload);
			// A lookup may have swapped the employee while this update was in flight;
			// applying the payload then would show one employee's away flag on another.
			if (this.employee?.id === id) {
				this._employee$.next({ ...this.employee, ...payload });
			}
		} catch (error) {
			this._errorHandler.handleError(error);
		} finally {
			this._isUpdatingStatus$.next(false);
		}
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
		return this._isSubmit$;
	}
}
