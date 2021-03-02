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
	ChangelogComponent,
	FooterComponent,
	HeaderComponent,
	LayoutSelectorComponent,
	SearchInputComponent,
	ThemeSettingsComponent
} from './components';
import { Pipes } from './pipes';
import {
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	PublicLayoutComponent
} from './layouts';
import { WindowModeBlockScrollService } from './services';
import {
	DEFAULT_THEME,
	COSMIC_THEME,
	CORPORATE_THEME,
	DARK_THEME
} from './styles';
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
import { SidebarModule } from './components/sidebar/sidebar.module';

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
	NbEvaIconsModule
];

const MODULES = [
	HeaderSelectorsModule,
	EmployeeSelectorsModule,
	ProjectSelectModule,
	TimeTrackerModule,
	TranslateModule,
	SidebarModule
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
	LayoutSelectorComponent,
	ChangelogComponent
];

const PIPES = [...Pipes];

@NgModule({
	imports: [CommonModule, RouterModule, ...NB_MODULES, ...MODULES],
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
