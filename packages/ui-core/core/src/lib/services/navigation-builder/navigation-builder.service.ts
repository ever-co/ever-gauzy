import { Injectable, Type } from '@angular/core';
import { BehaviorSubject, Observable, of as ObservableOf } from 'rxjs';
import { UntilDestroy } from '@ngneat/until-destroy';
import { isEmpty } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';

export interface ISidebarActionConfig {
	id: string;
	label: string;
	onClick?: (event: MouseEvent) => void;
	icon?: string;
	class?: string;
	permissions?: string[];
}

export interface ISidebarConfig {
	loadComponent: () => Promise<Type<any>> | Type<any>;
	id?: string;
	class?: string;
	title?: string;
	permissions?: string[];
	actionItem?: ISidebarActionConfig;
}

/**
 * An action a plugin adds to the header's action bar (for example the Inbox's unread badge). The component is
 * rendered inside an `nb-action`, after the built-in actions, ordered by `order` (then by registration).
 */
export interface IHeaderActionConfig {
	/** Unique; registering the same id again replaces the earlier action. */
	id: string;
	/** A standalone component, rendered with `NgComponentOutlet`. */
	component: Type<unknown>;
	/** Lower first; actions without one come last, in registration order. */
	order?: number;
	/** CSS class(es) of the `nb-action`. */
	class?: string;
	/** Shown only to a user holding every one of them. */
	permissions?: string[];
}

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class NavigationBuilderService {
	private sidebarMapper = new Map<string, ISidebarConfig>();

	public sidebars$: Observable<ISidebarConfig[]>;
	private _sidebars: ISidebarConfig[] = [];

	public sidebarActions$: Observable<ISidebarActionConfig[]>;
	private _addedActionBarItems: ISidebarActionConfig[] = [];

	private readonly _headerActions$ = new BehaviorSubject<IHeaderActionConfig[]>([]);
	/** The plugins' header actions (empty unless a plugin registered one). */
	public readonly headerActions$: Observable<IHeaderActionConfig[]> = this._headerActions$.asObservable();

	constructor(private readonly store: Store) {}

	/**
	 * Adds an action to the header's action bar, or replaces the action registered with the same id. Plugins
	 * may call it at any time (also after the header rendered): the header follows `headerActions$`.
	 */
	registerHeaderAction(config: IHeaderActionConfig): void {
		if (!config?.id || !config.component) {
			throw new Error('A header action needs an id and a component.');
		}
		const others = this._headerActions$.value.filter((action) => action.id !== config.id);
		const actions = [...others, { ...config }];
		// Stable: equal (or missing) orders keep their registration order.
		const rank = (action: IHeaderActionConfig) => action.order ?? Number.MAX_SAFE_INTEGER;
		this._headerActions$.next(
			actions
				.map((action, index) => ({ action, index }))
				.sort((a, b) => rank(a.action) - rank(b.action) || a.index - b.index)
				.map(({ action }) => action)
		);
	}

	/** Removes a header action (no-op for an unknown id). */
	removeHeaderAction(id: string): void {
		const actions = this._headerActions$.value;
		if (actions.some((action) => action.id === id)) {
			this._headerActions$.next(actions.filter((action) => action.id !== id));
		}
	}

	registerSidebar(id: string, config: ISidebarConfig): void {
		if (this.sidebarMapper.has(id)) {
			throw new Error(`A sidebar with the id "${id}" already exists`);
		}
		config = {
			id,
			...config
		};
		this.sidebarMapper.set(id, config);
	}

	addSidebarActionItem(config: ISidebarActionConfig) {
		this._addedActionBarItems.push({
			...config
		});
	}

	getSidebarById(id: string) {
		if (!this.sidebarMapper.has(id)) {
			throw new Error(`No sidebar was found with the id "${id}"`);
		}

		return this.sidebarMapper.get(id);
	}

	getAvailableSidebarIds() {
		return [...this.sidebarMapper.entries()]
			.filter(([, config]) => {
				return isEmpty(config.permissions) || this.hasPermissions(config.permissions);
			})
			.map(([id]) => id);
	}

	getSidebarWidgets() {
		this._sidebars = this.getAvailableSidebarIds().map((id) => {
			return this.getSidebarById(id);
		});

		this.sidebars$ = ObservableOf(this._sidebars);
		this.sidebarActions$ = ObservableOf(this._addedActionBarItems);
	}

	hasPermissions = (permissions: any): boolean => {
		return permissions.every((p: any) => this.store.hasPermission(p));
	};

	clearSidebars() {
		this.sidebarMapper.clear();
	}

	clearActionBars() {
		this._addedActionBarItems = [];
	}
}
