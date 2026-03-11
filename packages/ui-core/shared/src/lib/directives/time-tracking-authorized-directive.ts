import { ChangeDetectorRef, Directive, inject, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { filter, tap, map, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import camelcase from 'camelcase';
import { IOrganization, IUser } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Directive({
	selector: '[ngxTimeTrackingAuthorized]',
	standalone: true
})
export class TimeTrackingAuthorizedDirective implements OnInit {
	private _permission: string | string[] = []; // Default initialization
	/**
	 * Setter for dynamic permission.
	 * @param permission - The permission(s) to be set.
	 */
	@Input() set permission(permission: string | string[]) {
		if (!permission) {
			throw new Error('Permission must be provided');
		}
		this._permission = permission;
	}
	/**
	 * Getter for dynamic permission.
	 */
	get permission(): string | string[] {
		return this._permission;
	}

	@Input() permissionElse: TemplateRef<any>;

	private readonly _templateRef = inject(TemplateRef<any>);
	private readonly _viewContainer = inject(ViewContainerRef);
	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _store = inject(Store);

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				switchMap((organization: IOrganization) =>
					this._store.user$.pipe(
						filter((user: IUser) => !!user),
						map((user: IUser) => this._isAuthorized(organization, user)),
						distinctUntilChanged() // Only emit when permission status changes
					)
				),
				tap((hasPermission: boolean) => {
					if (hasPermission) {
						this._viewContainer.clear(); // Clear the container once per status change
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
	 * Determines if the user has the required permission within the organization.
	 *
	 * @param organization - The selected organization.
	 * @param user - The current user.
	 * @returns A boolean indicating if the user is authorized.
	 */
	private _isAuthorized(organization: IOrganization, user: IUser): boolean {
		const permissions = Array.isArray(this.permission) ? this.permission : [this.permission];
		return permissions.some((p) => {
			const key = camelcase(p);
			return !!organization[key] && (!user.employee || !!user.employee[key]);
		});
	}

	/**
	 * Show If/Else Render Template
	 *
	 * @param template
	 * @returns
	 */
	showTemplateBlockInView(template: TemplateRef<any>) {
		this._viewContainer.clear(); // Clear the container once per status change
		if (!template) {
			return;
		}

		this._viewContainer.createEmbeddedView(template);
		this._cdr.markForCheck();
	}
}
