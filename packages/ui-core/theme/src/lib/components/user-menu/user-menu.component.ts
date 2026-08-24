import { Component, HostListener, Input, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
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
					const employeeId = user?.employee?.id;
					const lookupId = ++this.lookupId;
					this._isSubmit$.next(true);
					try {
						const employee = await firstValueFrom(this._employeeService.getEmployeeById(employeeId));
						if (lookupId !== this.lookupId) {
							return;
						}
						this._employee$.next(employee);
					} catch (error) {
						// Only a still-current failure may clear the cached employee, and only
						// when that cache belongs to someone else: keeping a stale employee
						// would let onChangeStatus() write the away flag to the wrong one,
						// while a failed refresh of the same employee should leave the status
						// control on the data it already has.
						if (lookupId === this.lookupId && this.employee?.id !== employeeId) {
							this._employee$.next(null);
						}
						this._errorHandler.handleError(error);
					} finally {
						// Always release the loading state, otherwise a failed load leaves
						// the status control stuck behind a spinner for the whole session.
						// A superseded lookup leaves it to the newer one still running.
						if (lookupId === this.lookupId) {
							this._isSubmit$.next(false);
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
		if (!this.employee || this._isSubmit$.getValue()) {
			return;
		}
		this._isSubmit$.next(true);
		try {
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
		} finally {
			this._isSubmit$.next(false);
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
		return this._isSubmit$.asObservable();
	}
}
