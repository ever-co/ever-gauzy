import { AfterViewInit, Component, OnInit } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { NbMenuItem } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/common-angular';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store } from '../../@core/services';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';

interface IWorkSpace {
	id: string;
	imgUrl: string;
	isOnline: boolean;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-workspaces',
	templateUrl: './workspaces.component.html',
	styleUrls: ['./workspaces.component.scss']
})
export class WorkspacesComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	public _workspaces$: BehaviorSubject<IWorkSpace[]> = new BehaviorSubject([]);
	public workspaces$: Observable<IWorkSpace[]> = this._workspaces$.asObservable();

	selected: IWorkSpace;
	contextMenus: NbMenuItem[];
	user: IUser;

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

	getWorkspaces() {
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
	 * Translate context menus
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
	 * On Change workspace
	 *
	 * @param workspace
	 */
	onChangeWorkspace(workspace: IWorkSpace) {
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
