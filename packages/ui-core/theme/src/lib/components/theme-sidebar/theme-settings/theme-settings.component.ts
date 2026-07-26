import { Component, OnDestroy, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { NbSidebarService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-theme-settings',
    styleUrls: ['./theme-settings.component.scss'],
    templateUrl: './theme-settings.component.html',
    standalone: false
})
export class ThemeSettingsComponent implements AfterViewChecked, OnDestroy {
	private state: boolean;

	constructor(private readonly sidebarService: NbSidebarService, private readonly router: Router) {}

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

	/**
	 * Navigates to the settings page and closes the quick settings sidebar.
	 */
	public navigateToSettings() {
		this.router.navigate(['/pages/settings']);
		this.closeSidebar();
	}
}
