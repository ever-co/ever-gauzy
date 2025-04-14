import {
	Component,
	OnInit,
	EventEmitter,
	Output,
	ChangeDetectorRef,
	Input,
	AfterViewInit,
	Inject
} from '@angular/core';
import { tap, debounceTime, filter } from 'rxjs/operators';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { IOrganization } from '@gauzy/contracts';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import {
	COSMIC_THEME,
	DARK_THEME,
	DSPOT_ERP_LOGO_DARK,
	DSPOT_ERP_LOGO_LIGHT,
	GAUZY_DARK,
	MATERIAL_DARK_THEME
} from '../../themes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-logo',
	templateUrl: './gauzy-logo.component.html',
	styleUrls: ['./gauzy-logo.component.scss']
})
export class GauzyLogoComponent implements AfterViewInit, OnInit {
	public theme: string;
	public isCollapse = true;
	public organization: IOrganization;

	@Input() controlled = true;
	@Input() isAccordion = true;

	@Output() onCollapsed: EventEmitter<boolean> = new EventEmitter<boolean>(this.isCollapse);

	/**
	 * Checks if the logo file is in SVG format.
	 * @returns {boolean} True if the logo ends with '.svg' (case-insensitive), false otherwise.
	 */
	public isSVG(): boolean {
		const logo = 'assets/images/logos/dspot_erp_dark.svg';
		return logo ? logo.toLowerCase().endsWith('.svg') : false;
	}

	constructor(
		private readonly _themeService: NbThemeService,
		private readonly _cd: ChangeDetectorRef,
		private readonly _store: Store,
		@Inject(GAUZY_ENV) private readonly environment: Environment
	) {}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._themeService.onThemeChange().subscribe((theme) => {
			this.theme = theme.name;
			this._cd.detectChanges();
		});
	}

	/**
	 * Handles the collapse state of the accordion.
	 * @param isCollapsed - The new collapsed state of the accordion.
	 */
	onCollapse(isCollapsed: boolean): void {
		this.isCollapse = isCollapsed; // Update the collapse state
		this.onCollapsed.emit(this.isCollapse); // Emit the new state
	}

	/**
	 * Navigates to the home page.
	 * @returns false to prevent default behavior, if needed.
	 */
	navigateHome(): boolean {
		// this.menuService.navigateHome();
		return false; // Prevent default action
	}

	/**
	 * Checks if the current theme is a dark theme.
	 * @returns true if the theme is dark; otherwise, false.
	 */
	isDarkTheme(): boolean {
		return [DARK_THEME.name, COSMIC_THEME.name, GAUZY_DARK.name, MATERIAL_DARK_THEME.name].includes(this.theme);
	}

	/**
	 * Gets the logo URL based on the theme.
	 * @param isDark - Whether the theme is dark.
	 * @returns The logo URL.
	 */
	getLogoUrl(isDark: boolean): string {
		return isDark ? DSPOT_ERP_LOGO_DARK : DSPOT_ERP_LOGO_LIGHT;
	}
}
