import { Injectable, Type } from '@angular/core';
import { Observable, of as ObservableOf } from 'rxjs';
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

	constructor(private readonly store: Store) {}

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
