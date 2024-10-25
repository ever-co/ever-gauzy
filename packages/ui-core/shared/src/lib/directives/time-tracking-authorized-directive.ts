import { ChangeDetectorRef, Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { filter, tap, map, switchMap, distinctUntilChanged } from 'rxjs/operators';
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
				switchMap((organization: IOrganization) =>
					this._store.user$.pipe(
						filter((user: IUser) => !!user),
						map((user: IUser) => {
							// Determine permission based on employee existence
							const hasPermission = user.employee
								? camelcase(this.permission) in organization &&
								  organization[camelcase(this.permission)] &&
								  camelcase(this.permission) in user.employee &&
								  user.employee[camelcase(this.permission)]
								: camelcase(this.permission) in organization &&
								  organization[camelcase(this.permission)];

							return hasPermission;
						}),
						distinctUntilChanged() // Only emit when permission status changes
					)
				),
				tap((hasPermission: boolean) => {
					this._viewContainer.clear(); // Clear the container once per status change

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
