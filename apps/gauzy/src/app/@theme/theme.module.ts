import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
	SearchInputComponent
} from './components';
import { Pipes } from './pipes';
import {
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent
} from './layouts';
import { WindowModeBlockScrollService } from './services/window-mode-block-scroll.service';
import { DEFAULT_THEME } from './styles/theme.default';
import { COSMIC_THEME } from './styles/theme.cosmic';
import { CORPORATE_THEME } from './styles/theme.corporate';
import { DARK_THEME } from './styles/theme.dark';
import { ThemeSettingsComponent } from './components/theme-settings/theme-settings.component';
import { UsersService } from '../@core/services/users.service';
import { HeaderSelectorsModule } from './components/header/selectors/selectors.module';
import { EmployeeSelectorsModule } from './components/header/selectors/employee/employee.module';
import { SelectorService } from '../@core/utils/selector.service';
import { UsersOrganizationsService } from '../@core/services/users-organizations.service';
import { OrganizationsService } from '../@core/services/organizations.service';
import { TimeTrackerModule } from '../@shared/time-tracker/time-tracker.module';
import { LanguagesService } from '../@core/services/languages.service';
import { LayoutSelectorComponent } from './components/layout-selector/layout-selector.component';
import { ProjectSelectModule } from '../@shared/project-select/project-select.module';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '../@shared/translate/translate.module';

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
	HeaderSelectorsModule,
	EmployeeSelectorsModule,
	ProjectSelectModule,
	TimeTrackerModule,
	TranslateModule,
	RouterModule
];

const COMPONENTS = [
	HeaderComponent,
	FooterComponent,
	SearchInputComponent,
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent,
	ThemeSettingsComponent,
	LayoutSelectorComponent
];

const PIPES = [...Pipes];

@NgModule({
	imports: [CommonModule, ...NB_MODULES],
	exports: [CommonModule, ...PIPES, ...COMPONENTS],
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
				...NbThemeModule.forRoot(
					{
						name: 'default'
					},
					[DEFAULT_THEME, COSMIC_THEME, CORPORATE_THEME, DARK_THEME]
				).providers,
				WindowModeBlockScrollService
			]
		};
	}
}
