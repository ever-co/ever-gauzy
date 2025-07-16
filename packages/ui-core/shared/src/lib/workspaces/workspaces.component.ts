import { AfterViewInit, Component, OnInit } from '@angular/core';
import { debounceTime, filter, tap, catchError, finalize } from 'rxjs/operators';
import { BehaviorSubject, Observable, EMPTY, of } from 'rxjs';
import { NbMenuItem } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IUser, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, AuthService, ToastrService } from '@gauzy/ui-core/core';
import { WorkspaceResetService } from './workspace-reset.service';

interface IWorkSpace {
	id: string;
	name: string;
	imgUrl: string;
	isOnline: boolean;
	isSelected?: boolean;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-workspaces',
	templateUrl: './workspaces.component.html',
	styleUrls: ['./workspaces.component.scss'],
	standalone: false
})
export class WorkspacesComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	public _workspaces$: BehaviorSubject<IWorkSpace[]> = new BehaviorSubject([]);
	public workspaces$: Observable<IWorkSpace[]> = this._workspaces$.asObservable();

	public selected: IWorkSpace;
	public contextMenus: NbMenuItem[];
	public user: IUser;
	public loading = false;
	public error: string | null = null;

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly authService: AuthService,
		private readonly toastrService: ToastrService,
		private readonly workspaceResetService: WorkspaceResetService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._createContextMenus();
		this._applyTranslationOnChange();
	}

	ngAfterViewInit() {
		this.store.user$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.getWorkspaces()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieves all workspaces that the current authenticated user has access to.
	 *
	 * @return {void} This function does not return a value.
	 */
	getWorkspaces(): void {
		if (!this.user?.id) {
			return;
		}

		this.loading = true;
		this.error = null;

		this.authService
			.getUserWorkspaces(false)
			.pipe(
				tap(({ workspaces }: IUserSigninWorkspaceResponse) => {
					const mappedWorkspaces: IWorkSpace[] = workspaces.map((workspace) => ({
						id: workspace.user.tenant.id,
						name: workspace.user.tenant.name,
						imgUrl: workspace.user.tenant.logo || '/assets/images/default.svg',
						isOnline: true,
						isSelected: workspace.user.tenant.id === this.user.tenantId
					}));

					this._workspaces$.next(mappedWorkspaces);

					// Set the selected workspace
					this.selected = mappedWorkspaces.find((w) => w.isSelected) || mappedWorkspaces[0];
				}),
				catchError((error) => {
					console.error('Error fetching workspaces:', error);
					this.error = 'Failed to load workspaces';
					this.toastrService.danger('Failed to load workspaces', 'Error');
					return of({ workspaces: [], total_workspaces: 0 } as IUserSigninWorkspaceResponse);
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Applies translation changes by subscribing to the onLangChange observable provided by translateService.
	 * When a language change occurs, it triggers the creation of context menus.
	 *
	 * @return {void} This function does not return a value.
	 */
	private _applyTranslationOnChange() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._createContextMenus()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Switches to the selected workspace with complete reset (logout/login approach).
	 *
	 * @param {IWorkSpace} workspace - The workspace to switch to.
	 * @return {void} This function does not return a value.
	 */
	onChangeWorkspace(workspace: IWorkSpace): void {
		if (workspace.id === this.selected?.id || this.loading) {
			return; // Already selected or loading
		}

		this.loading = true;
		this.error = null;

		// Use the workspace reset service (complete reset approach)
		this.workspaceResetService
			.switchWorkspace(workspace.id)
			.pipe(
				tap(() => {
					// Update local workspace state
					this.updateLocalWorkspaceState(workspace);
					// Note: Success notification is handled by the service
				}),
				catchError((error) => {
					console.error('Error switching workspace:', error);
					this.error = 'Failed to switch workspace';
					this.toastrService.danger('Failed to switch workspace. Please try again.', 'Error');
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create bulk action context menus
	 */
	private _createContextMenus() {
		this.contextMenus = [
			{
				title: this.getTranslation('WORKSPACES.MENUS.SING_ANOTHER_WORKSPACE')
			},
			{
				title: this.getTranslation('WORKSPACES.MENUS.CREATE_NEW_WORKSPACE')
			},
			{
				title: this.getTranslation('WORKSPACES.MENUS.FIND_WORKSPACE')
			}
		];
	}

	/**
	 * Create new workspace
	 *
	 */
	add() {
		// TODO
	}

	/**
	 * Updates the local workspace state after a successful switch.
	 *
	 * @param {IWorkSpace} newWorkspace - The workspace that was switched to.
	 * @return {void} This function does not return a value.
	 */
	private updateLocalWorkspaceState(newWorkspace: IWorkSpace): void {
		// Update workspace states
		const currentWorkspaces = this._workspaces$.getValue();
		const updatedWorkspaces = currentWorkspaces.map((w) => ({
			...w,
			isSelected: w.id === newWorkspace.id,
			isOnline: w.id === newWorkspace.id ? true : w.isOnline
		}));

		this._workspaces$.next(updatedWorkspaces);
		this.selected = { ...newWorkspace, isSelected: true };
	}
}
