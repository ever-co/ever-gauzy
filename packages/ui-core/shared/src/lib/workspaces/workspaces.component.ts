import { AfterViewInit, Component, OnInit } from '@angular/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { NbMenuItem } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IUser } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

interface IWorkSpace {
	id: string;
	imgUrl: string;
	isOnline: boolean;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-workspaces',
	templateUrl: './workspaces.component.html',
	styleUrls: ['./workspaces.component.scss']
})
export class WorkspacesComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	public _workspaces$: BehaviorSubject<IWorkSpace[]> = new BehaviorSubject([]);
	public workspaces$: Observable<IWorkSpace[]> = this._workspaces$.asObservable();

	public selected: IWorkSpace;
	public contextMenus: NbMenuItem[];
	public user: IUser;

	constructor(public readonly translateService: TranslateService, private readonly store: Store) {
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
	 * Retrieves the workspaces associated with the user's tenant.
	 *
	 * @return {void} This function does not return a value.
	 */
	getWorkspaces(): void {
		if (!this.user.tenantId) {
			return;
		}
		const { tenant } = this.user;
		const workspace = {
			id: tenant.id,
			imgUrl: tenant.logo,
			isOnline: true
		};
		const workspaces = this._workspaces$.getValue();
		const index = workspaces.find((workspace: IWorkSpace) => workspace.id === tenant.id);

		if (!index) {
			this._workspaces$.next([...workspaces, workspace]);
			this.selected = workspace;
		}
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
	 * Updates the selected workspace and sets its `isOnline` property to `true`.
	 *
	 * @param {IWorkSpace} workspace - The workspace to be selected.
	 * @return {void} This function does not return a value.
	 */
	onChangeWorkspace(workspace: IWorkSpace): void {
		this.selected = workspace;
		this.selected.isOnline = true;
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
}
