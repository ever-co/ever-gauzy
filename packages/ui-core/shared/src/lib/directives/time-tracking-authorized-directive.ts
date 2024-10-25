import { ChangeDetectorRef, Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { filter, tap, map, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as camelcase from 'camelcase';
import { IOrganization, IUser } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[ngxTimeTrackingAuthorized]'
})
export class TimeTrackingAuthorizedDirective implements OnInit {
	/*
	 * Getter & Setter for dynamic permission
	 */
	_permission: string | string[];
	get permission(): string | string[] {
		return this._permission;
	}
	@Input() set permission(permission: string | string[]) {
		if (!permission) {
			throw false;
		}
		this._permission = permission;
	}

	@Input() permissionElse: TemplateRef<any>;

	constructor(
		private readonly _templateRef: TemplateRef<any>,
		private readonly _viewContainer: ViewContainerRef,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _store: Store
	) {}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap(() => this._viewContainer.clear()),
				switchMap((organization: IOrganization) =>
					this._store.user$.pipe(
						filter((user: IUser) => !!user),
						map((user: IUser) => {
							const permissions = Array.isArray(this.permission) ? this.permission : [this.permission];

							const hasPermissions = (source: any) =>
								permissions.every((permission) => {
									const permKey = camelcase(permission);
									return permKey in source && source[permKey];
								});

							const hasOrgPermission = hasPermissions(organization);

							if (user.employee) {
								// Check if the permission is in the organization and in the employee properties
								const hasEmployeePermission = hasPermissions(user.employee);
								return hasOrgPermission && hasEmployeePermission;
							} else {
								return hasOrgPermission;
							}
						})
					)
				),
				tap((hasPermission: boolean) => {
					if (hasPermission) {
						this._viewContainer.createEmbeddedView(this._templateRef);
					} else {
						this.showTemplateBlockInView(this.permissionElse);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Show If/Else Render Template
	 *
	 * @param template
	 * @returns
	 */
	showTemplateBlockInView(template: TemplateRef<any>) {
		this._viewContainer.clear();
		if (!template) {
			return;
		}
		this._viewContainer.createEmbeddedView(template);
		this._cdr.markForCheck();
	}
}
