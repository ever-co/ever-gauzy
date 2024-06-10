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
import {
	COSMIC_THEME,
	DEFAULT_THEME,
	GAUZY_DARK,
	GAUZY_LIGHT,
	MATERIAL_DARK_THEME,
	MATERIAL_LIGHT_THEME,
	Pipes,
	WindowModeBlockScrollService
} from '@gauzy/ui-sdk/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CommonNavModule,
	LanguagesService,
	OrganizationsService,
	SelectorService,
	UsersOrganizationsService,
	UsersService
} from '@gauzy/ui-sdk/core';
import { DirectivesModule, UnderConstructionPopupComponent, WorkspacesModule } from '@gauzy/ui-sdk/shared';
import {
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent
} from './layouts';
import { FooterComponent, HeaderComponent } from './components';
import { HeaderSelectorsModule } from './components/header/selectors/selectors.module';
import { EmployeeSelectorsModule } from './components/header/selectors/employee/employee.module';
import { TimeTrackerModule } from '../@shared/time-tracker/time-tracker.module';
import { ProjectSelectModule } from '../@shared/project-select/project-select.module';
import { ThemeSidebarModule } from './components/theme-sidebar/theme-sidebar.module';
import { GauzyLogoComponent } from './components/gauzy-logo/gauzy-logo.component';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { UserComponent } from './components/user/user.component';
import { ThemeSelectorModule } from './components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';
import { DateRangePickerModule } from './components/header/selectors/date-range-picker';
import { TimeTrackerStatusModule } from '../@shared/time-tracker/components/time-tracker-status/time-tracker-status.module';
import { TeamSelectModule } from '../@shared/team-select/team-select.module';
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
	HeaderSelectorsModule,
	DateRangePickerModule,
	EmployeeSelectorsModule,
	ProjectSelectModule,
	TeamSelectModule,
	TimeTrackerModule,
	I18nTranslateModule.forChild(),
	ThemeLanguageSelectorModule,
	ThemeSelectorModule,
	WorkspacesModule,
	NgxPermissionsModule.forChild(),
	CommonNavModule,
	DirectivesModule,
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
	UserComponent,
	UnderConstructionPopupComponent
];

const PIPES = [...Pipes];

const EXPORT_IMPORT = [CommonModule, ThemeSidebarModule, MatRippleModule];

@NgModule({
	imports: [RouterModule, ...EXPORT_IMPORT, ...NB_MODULES, ...MODULES],
	exports: [...EXPORT_IMPORT, ...PIPES, ...COMPONENTS],
	declarations: [...COMPONENTS, ...PIPES],
	providers: [
		UsersService,
		SelectorService,
		UsersOrganizationsService,
		OrganizationsService,
		NbLayoutDirectionService,
		LanguagesService,
		ThemeLanguageSelectorService
	]
})
export class ThemeModule {
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
