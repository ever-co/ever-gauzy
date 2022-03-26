import { Component, OnDestroy, OnInit, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { tap, debounceTime, filter } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { Store } from '../../../@core/services';
import { distinctUntilChange } from '@gauzy/common-angular';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-logo',
	templateUrl: './gauzy-logo.component.html',
	styleUrls: ['./gauzy-logo.component.scss']
})
export class GauzyLogoComponent implements OnInit, OnDestroy {
	theme: string;
	isCollapse: boolean = true;
	organization: IOrganization;
  @Output() onCollapsed: EventEmitter<boolean> = new EventEmitter<boolean>(this.isCollapse);
	constructor(
		private readonly themeService: NbThemeService,
		private readonly store: Store,
    private readonly cd: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				untilDestroyed(this)
			)
			.subscribe();
		this.themeService
			.onThemeChange()
			.subscribe((theme) => {
				this.theme = theme.name;
        this.cd.detectChanges();
			});
	}
	onCollapse(event: boolean) {
		this.isCollapse = event;
    this.onCollapsed.emit(this.isCollapse);
	}
	navigateHome() {
		//this.menuService.navigateHome();
		return false;
	}

	ngOnDestroy(): void {}
}
