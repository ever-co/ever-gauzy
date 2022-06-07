import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbSidebarService } from '@nebular/theme';

@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent implements OnInit, OnDestroy {

	constructor(
		private readonly sidebarService: NbSidebarService
	) {}

	ngOnInit(): void {}

	ngOnDestroy(): void {}

	public closeSidebar() {
		this.sidebarService.toggle(false, 'settings_sidebar');
	}
}
