import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
	NbLayoutDirectionService
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbSecurityModule } from '@nebular/security';

import {
	FooterComponent,
	HeaderComponent,
	LayoutSelectorComponent,
	SearchInputComponent
} from './components';
import { Pipes } from './pipes';
import {
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent
} from './layouts';

import { DEFAULT_THEME } from './styles/theme.default';
import { COSMIC_THEME } from './styles/theme.cosmic';
import { CORPORATE_THEME } from './styles/theme.corporate';
import { DARK_THEME } from './styles/theme.dark';
import { MATERIAL_LIGHT_THEME } from './styles/material/theme.material-light';
 import { MATERIAL_DARK_THEME } from './styles/material/theme.material-dark';
import { GAUZY_LIGHT } from './styles/gauzy/theme.gauzy-light';
import { GAUZY_DARK } from './styles/gauzy/theme.gauzy-dark';

import { NgxPermissionsModule } from 'ngx-permissions';
import { WindowModeBlockScrollService } from './services';

import { UsersService } from '../@core/services/users.service';
import { HeaderSelectorsModule } from './components/header/selectors/selectors.module';
import { EmployeeSelectorsModule } from './components/header/selectors/employee/employee.module';
import { SelectorService } from '../@core/utils/selector.service';
import { UsersOrganizationsService } from '../@core/services/users-organizations.service';
import { OrganizationsService } from '../@core/services/organizations.service';
import { TimeTrackerModule } from '../@shared/time-tracker/time-tracker.module';
import { LanguagesService } from '../@core/services/languages.service';
import { ProjectSelectModule } from '../@shared/project-select/project-select.module';
import { TranslateModule } from '../@shared/translate/translate.module';
import { ThemeSidebarModule } from './components/theme-sidebar/theme-sidebar.module';
import { MatRippleModule } from '@angular/material/core';
import { NbAccordionModule, NbToggleModule } from '@nebular/theme';
import { GauzyLogoComponent } from './components/gauzy-logo/gauzy-logo.component';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { UserComponent } from './components/user/user.component';
import { ThemeLanguageSelectorModule } from './components/theme-sidebar/theme-settings/components/theme-language-selector.module';
import { ThemeSelectorModule } from './components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';

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
  NbToggleModule
];

const MODULES = [
	HeaderSelectorsModule,
	EmployeeSelectorsModule,
	ProjectSelectModule,
	TimeTrackerModule,
	TranslateModule,
  ThemeLanguageSelectorModule,
  ThemeSelectorModule,
	NgxPermissionsModule.forChild(),
];

const COMPONENTS = [
	HeaderComponent,
	FooterComponent,
	SearchInputComponent,
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent,
	LayoutSelectorComponent,
  GauzyLogoComponent,
  UserMenuComponent,
  UserComponent
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
		LanguagesService
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
