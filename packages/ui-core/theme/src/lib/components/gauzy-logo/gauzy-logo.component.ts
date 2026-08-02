import {
	Component,
	OnDestroy,
	OnInit,
	EventEmitter,
	Output,
	ChangeDetectorRef,
	Input,
	AfterViewInit,
	Inject
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { combineLatest } from 'rxjs';
import { tap, debounceTime, map } from 'rxjs/operators';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { IUser, IWorkSpace } from '@gauzy/contracts';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';
import { DEFAULT_SVG, distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { COSMIC_THEME, DARK_THEME, GAUZY_DARK, MATERIAL_DARK_THEME } from '../../themes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-logo',
	templateUrl: './gauzy-logo.component.html',
	styleUrls: ['./gauzy-logo.component.scss'],
	standalone: false
})
export class GauzyLogoComponent implements AfterViewInit, OnInit, OnDestroy {
	public theme: string;
	public isCollapse = true;
	public logoUrl: SafeResourceUrl;
	public isWorkspaceOpen = false;

	/** Active tenant (workspace) shown by the sidebar switcher. */
	public tenantName = '';
	public tenantLogo: string = DEFAULT_SVG;

	private _controlled = true;
	@Input()
	get controlled(): boolean {
		return this._controlled;
	}
	set controlled(value: boolean) {
		this._controlled = value;
		// Defer update to avoid change detection issues
		setTimeout(() => (this.isCollapse = value), 0);
	}

	@Input() isAccordion = true;
	@Output() onCollapsed: EventEmitter<boolean> = new EventEmitter<boolean>(this.isCollapse);
	@Output() onWorkspaceToggle: EventEmitter<boolean> = new EventEmitter<boolean>();

	/**
	 * Checks if the logo file is in SVG format.
	 * @returns {boolean} True if the logo ends with '.svg' (case-insensitive), false otherwise.
	 */
	public isSVG(): boolean {
		const logo = this.environment.PLATFORM_LOGO;
		return logo ? logo.toLowerCase().endsWith('.svg') : false;
	}

	constructor(
		private readonly _themeService: NbThemeService,
		private readonly _domSanitizer: DomSanitizer,
		private readonly _cd: ChangeDetectorRef,
		private readonly _store: Store,
		@Inject(GAUZY_ENV) private readonly environment: Environment
	) {
		this.logoUrl = this._domSanitizer.bypassSecurityTrustResourceUrl(environment.PLATFORM_LOGO);
	}

	ngOnInit(): void {
		// The switcher identifies the TENANT. `selectedWorkspace` only exists once
		// the switcher panel has fetched the workspace list, so the signed-in
		// user's own tenant is the authoritative source until then (and the only
		// one available to users with a single tenant, who never load the list).
		combineLatest([this._store.user$, this._store.selectedWorkspace$])
			.pipe(
				debounceTime(100),
				// Narrow to the two values actually rendered BEFORE the equality
				// check — `user$` carries the whole user graph, and comparing that
				// on every emission is pure waste.
				map(([user, workspace]: [IUser, IWorkSpace]) => ({
					name: workspace?.name || user?.tenant?.name || '',
					logo: workspace?.imgUrl || user?.tenant?.logo || DEFAULT_SVG
				})),
				distinctUntilChange(),
				tap(({ name, logo }) => {
					this.tenantName = name;
					this.tenantLogo = logo;
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
	 * Toggles the workspace dropdown.
	 */
	toggleWorkspace(): void {
		this.isWorkspaceOpen = !this.isWorkspaceOpen;
		this.onWorkspaceToggle.emit(this.isWorkspaceOpen);
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
	 * Determines if the logo should have the 'white-svg' class.
	 * @returns true if isSVG is true and the theme is dark; otherwise, false.
	 */
	isWhiteSvg(): boolean {
		return this.isSVG && this.isDarkTheme();
	}

	/**
	 * Checks if the current theme is a dark theme.
	 * @returns true if the theme is dark; otherwise, false.
	 */
	isDarkTheme(): boolean {
		return [DARK_THEME.name, COSMIC_THEME.name, GAUZY_DARK.name, MATERIAL_DARK_THEME.name].includes(this.theme);
	}

	ngOnDestroy(): void {}
}
