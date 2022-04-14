import { AfterViewInit, Component, OnInit } from '@angular/core';
import { ITenant, IUser } from '@gauzy/contracts';
import { NbMenuItem } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs/internal/Subject';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store } from '../../@core/services';
import { TranslationBaseComponent } from '../language-base';

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
export class WorkspacesComponent extends TranslationBaseComponent implements 
	AfterViewInit, OnInit {
	
	workspaces: IWorkSpace[] = [];
	selected: IWorkSpace;
	contextMenus: NbMenuItem[];
	user: IUser;
	workspaces$: Subject<any> = new Subject();

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this._createContextMenus();
		this._applyTranslationOnChange();
	}

	ngAfterViewInit() {
		this.workspaces$
			.pipe(
				debounceTime(300),
				tap(() => this.getWorkspaces()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.workspaces$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getWorkspaces() {
		const tenant: ITenant = this.user.tenant;
		const defaultWorkspace = {
			id: tenant.id,
			imgUrl: tenant.logo,
			isOnline: true
		}
		this.workspaces.push(defaultWorkspace);
		this.selected = defaultWorkspace;
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
	 * On Change Workspace
	 * 
	 * @param workSpace 
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
