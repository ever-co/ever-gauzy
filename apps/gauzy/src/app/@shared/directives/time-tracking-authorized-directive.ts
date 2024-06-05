import { ChangeDetectorRef, Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as camelCase from 'camelcase';
import { IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';

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
				filter((organization: IOrganization) => camelCase(this.permission) in organization),
				tap(() => this._viewContainer.clear()),
				tap((organization: IOrganization) => {
					if (organization[camelCase(this.permission)]) {
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
