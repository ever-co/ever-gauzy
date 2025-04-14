import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DSPOT_ERP_LOGO_LIGHT, DSPOT_ERP_LOGO_DARK } from '../constants';
import { NbThemeService } from '@nebular/theme';

@Component({
	selector: 'gauzy-logo',
	templateUrl: './logo.component.html',
	styleUrls: ['./logo.component.scss']
})
export class LogoComponent implements AfterViewInit {
	theme: string;
	logoUrl: SafeResourceUrl;

	constructor(
		private readonly _domSanitizer: DomSanitizer,
		public readonly _themeService: NbThemeService,
		private readonly _cd: ChangeDetectorRef
	) {}

	ngAfterViewInit() {
		this._themeService.onThemeChange().subscribe((theme) => {
			this.theme = theme.name;
			this.updateLogoUrl();
			this._cd.detectChanges();
		});

		// Get the current theme on component initialization
		const currentTheme = this._themeService.currentTheme;
		this.theme = currentTheme;
		this.updateLogoUrl();
	}

	private updateLogoUrl() {
		this.logoUrl = this._domSanitizer.bypassSecurityTrustResourceUrl(
			this.isDarkTheme ? DSPOT_ERP_LOGO_DARK : DSPOT_ERP_LOGO_LIGHT
		);
	}

	/**
	 * Checks if the current theme is a dark theme.
	 * @returns true if the theme is dark; otherwise, false.
	 */
	public get isDarkTheme(): boolean {
		return this.theme.includes('dark');
	}
}
