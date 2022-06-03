import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import { distinctUntilChange } from "@gauzy/common-angular";
import { filter, tap } from "rxjs/operators";
import { IOrganization } from "@gauzy/contracts";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import * as camelCase from 'camelcase';
import { Store } from "../../@core/services";

@UntilDestroy({ checkProperties: true })
@Directive({
    selector: '[ngxTimerAuthorized]'
})
export class TimerAuthorizedDirective implements OnInit {

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
  
    constructor(
        private readonly _templateRef: TemplateRef<any>,
        private readonly _viewContainer: ViewContainerRef,
        private readonly _store: Store,
    ) {}
  
    ngOnInit(): void {
        this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
                filter((organization: IOrganization) => (
                    camelCase(this.permission) in organization
                )),
				tap((organization: IOrganization) => {
                    if (organization[camelCase(this.permission)]) {
                        this._viewContainer.createEmbeddedView(this._templateRef);
                    } else {
                        this._viewContainer.clear();
                    }
				}),
				untilDestroyed(this)
			)
			.subscribe();
    }
}