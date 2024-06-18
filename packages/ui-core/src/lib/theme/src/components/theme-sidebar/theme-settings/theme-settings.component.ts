import { Component, OnDestroy, AfterViewChecked } from '@angular/core';
import { NbSidebarService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent implements AfterViewChecked, OnDestroy {
	private state: boolean;

	constructor(private readonly sidebarService: NbSidebarService) {}

	ngAfterViewChecked(): void {
		this.sidebarService
			.getSidebarState('settings_sidebar')
			.pipe(
				tap((state) => (this.state = state === 'expanded' ? true : false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	/**
	 *
	 */
	public closeSidebar() {
		this.sidebarService.toggle(false, 'settings_sidebar');
	}

	/**
	 *
	 * @param event
	 */
	public onClickOutside(event: boolean) {
		if (!event && this.state) this.closeSidebar();
	}
}
