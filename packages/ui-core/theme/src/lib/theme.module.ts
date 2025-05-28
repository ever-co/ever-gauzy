import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import {
	NbActionsModule,
	NbLayoutModule,
	NbMenuModule,
	NbSearchModule,
	NbSidebarModule,
	NbUserModule,
	NbContextMenuModule,
	NbButtonModule,
	NbSelectModule,
	NbIconModule,
	NbThemeModule,
	NbPopoverModule,
	NbTooltipModule,
	NbLayoutDirectionService,
	NbSpinnerModule,
	CORPORATE_THEME,
	DARK_THEME,
	NbAccordionModule,
	NbToggleModule,
	NbCardModule
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbSecurityModule } from '@nebular/security';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	CommonNavModule,
	LanguagesService,
	OrganizationsService,
	SelectorService,
	UsersOrganizationsService
} from '@gauzy/ui-core/core';
import {
	DirectivesModule,
	SelectorsModule,
	TimeTrackerModule,
	TimeTrackerStatusModule,
	WorkspacesModule
} from '@gauzy/ui-core/shared';
import {
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent
} from './layouts';
import {
	COSMIC_THEME,
	DEFAULT_THEME,
	GAUZY_DARK,
	GAUZY_LIGHT,
	MATERIAL_DARK_THEME,
	MATERIAL_LIGHT_THEME
} from './themes';
import { Pipes } from './pipes';
import { WindowModeBlockScrollService } from './services';
import { FooterComponent, HeaderComponent } from './components';
import { ThemeSidebarModule } from './components/theme-sidebar/theme-sidebar.module';
import { GauzyLogoComponent } from './components/gauzy-logo/gauzy-logo.component';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { UserComponent } from './components/user/user.component';
import { ThemeSelectorModule } from './components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';
import { ThemeLanguageSelectorModule } from './components/theme-sidebar/theme-settings/components/theme-language-selector/theme-language-selector.module';
import { ThemeLanguageSelectorService } from './components/theme-sidebar/theme-settings/components/theme-language-selector/theme-language-selector.service';

const NB_MODULES = [
	NbLayoutModule,
	NbMenuModule,
	NbUserModule,
	NbActionsModule,
	NbSearchModule,
	NbSidebarModule,
	NbContextMenuModule,
	NbSecurityModule,
	NbButtonModule,
	NbSelectModule,
	NbIconModule,
	NbTooltipModule,
	NbPopoverModule,
	NbEvaIconsModule,
	NbAccordionModule,
	NbToggleModule,
	NbCardModule,
	NbSpinnerModule
];

const MODULES = [
	SelectorsModule,
	TranslateModule.forChild(),
	NgxPermissionsModule.forChild(),
	ThemeLanguageSelectorModule,
	ThemeSelectorModule,
	WorkspacesModule,
	CommonNavModule,
	DirectivesModule,
	TimeTrackerModule,
	TimeTrackerStatusModule
];

const COMPONENTS = [
	HeaderComponent,
	FooterComponent,
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent,
	GauzyLogoComponent,
	UserMenuComponent,
	UserComponent
];

const PIPES = [...Pipes];

const EXPORT_IMPORT = [ThemeSidebarModule, MatRippleModule];

@NgModule({
	imports: [CommonModule, RouterModule, ...EXPORT_IMPORT, ...NB_MODULES, ...MODULES],
	exports: [...EXPORT_IMPORT, ...PIPES, ...COMPONENTS],
	declarations: [...COMPONENTS, ...PIPES],
	providers: [
		SelectorService,
		UsersOrganizationsService,
		OrganizationsService,
		NbLayoutDirectionService,
		LanguagesService,
		ThemeLanguageSelectorService
	]
})
export class ThemeModule {
	/**
	 * Returns a ModuleWithProviders object that can be used to configure the ThemeModule.
	 *
	 * @return {ModuleWithProviders<ThemeModule>} The ModuleWithProviders object containing the ThemeModule and an empty providers array.
	 */
	static forRoot(): ModuleWithProviders<ThemeModule> {
		return {
			ngModule: ThemeModule,
			providers: [
				...NbThemeModule.forRoot({ name: GAUZY_LIGHT.name }, [
					DEFAULT_THEME,
					COSMIC_THEME,
					CORPORATE_THEME,
					DARK_THEME,
					MATERIAL_LIGHT_THEME,
					MATERIAL_DARK_THEME,
					GAUZY_LIGHT,
					GAUZY_DARK
				]).providers,
				WindowModeBlockScrollService
			]
		};
	}
}
