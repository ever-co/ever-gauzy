import {
	APP_INITIALIZER,
	FactoryProvider,
	Injectable,
	Type
} from '@angular/core';
import { Observable, of } from 'rxjs';
import { UntilDestroy } from '@ngneat/until-destroy';
import { isEmpty } from '@gauzy/common-angular';
import { PermissionsEnum } from '@gauzy/contracts';
import { Store } from '../store.service';

export interface ISidebarActionItem {
	id: string;
	label: string;
	onClick?: (event: MouseEvent) => void;
	icon?: string;
	requiresPermission?: string | string[] | PermissionsEnum;
}

export interface ISidebarConfig {
	loadComponent: () => Promise<Type<any>> | Type<any>;
	id?: string;
	class?: string;
	title?: string;
	permissions?: string | string[] | PermissionsEnum;
	action?: ISidebarActionItem;
}

export function addSidebarActionItem(
	config: ISidebarActionItem
): FactoryProvider {
	return {
		provide: APP_INITIALIZER,
		multi: true,
		useFactory: (
			navigationBuilderService: NavigationBuilderService
		) => () => {
			navigationBuilderService.addSidebarActionItem(config);
		},
		deps: [NavigationBuilderService]
	};
}

export function registerSidebarWidget(
	id: string,
	config: ISidebarConfig
): FactoryProvider {
	return {
		provide: APP_INITIALIZER,
		multi: true,
		useFactory: (
			navigationBuilderService: NavigationBuilderService
		) => () => {
			navigationBuilderService.registerSidebar(id, config);
		},
		deps: [NavigationBuilderService]
	};
}

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class NavigationBuilderService {
	private sidebars = new Map<string, ISidebarConfig>();

	public nbActionConfig$: Observable<ISidebarActionItem[]>;
	private addedActionBarItems: ISidebarActionItem[] = [];

	constructor(private readonly store: Store) {
		this.nbActionConfig$ = of(this.addedActionBarItems);
	}

	addSidebarActionItem(config: ISidebarActionItem) {
		this.addedActionBarItems.push({
			...config
		});
	}

	registerSidebar(id: string, config: ISidebarConfig) {
		if (this.sidebars.has(id)) {
			throw new Error(`A sidebar with the id "${id}" already exists`);
		}

		this.sidebars.set(id, config);
	}

	getSidebarById(id: string) {
		if (!this.sidebars.has(id)) {
			throw new Error(`No sidebar was found with the id "${id}"`);
		}

		return this.sidebars.get(id);
	}

	getAvailableSidebarIds() {
		return [...this.sidebars.entries()]
			.filter(([id, config]) => {
				return (
					isEmpty(config.permissions) ||
					this.hasAllPermissions(config.permissions)
				);
			})
			.map(([id]) => id);
	}

	getSidebarWidgets(): ISidebarConfig[] {
		return this.getAvailableSidebarIds().map((id) => {
			return {
				id,
				...this.getSidebarById(id)
			};
		});
	}

	hasAllPermissions = (permissions: any): boolean => {
		return permissions.every((p: any) => this.store.hasPermission(p));
	};
}
