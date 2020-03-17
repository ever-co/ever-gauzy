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
	NbThemeModule
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbSecurityModule } from '@nebular/security';
import {
	FooterComponent,
	HeaderComponent,
	SearchInputComponent,
	TinyMCEComponent
} from './components';
import {
	CapitalizePipe,
	PluralPipe,
	RoundPipe,
	TimingPipe,
	NumberWithCommasPipe,
	EvaIconsPipe
} from './pipes';
import {
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent
} from './layouts';
import { WindowModeBlockScrollService } from './services/window-mode-block-scroll.service';
import { DEFAULT_THEME } from './styles/theme.default';
import { COSMIC_THEME } from './styles/theme.cosmic';
import { CORPORATE_THEME } from './styles/theme.corporate';
import { DARK_THEME } from './styles/theme.dark';
import { ThemeSettingsComponent } from './components/theme-settings/theme-settings.component';
import { UsersService } from '../@core/services/users.service';
import { HeaderSelectorsModule } from './components/header/selectors/selectors.module';

import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { EmployeeSelectorsModule } from './components/header/selectors/employee/employee.module';
import { SelectorService } from '../@core/utils/selector.service';
import { UsersOrganizationsService } from '../@core/services/users-organizations.service';
import { OrganizationsService } from '../@core/services/organizations.service';
import { TimeTrackerModule } from '../@shared/time-tracker/time-tracker.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
	NbEvaIconsModule,
	HeaderSelectorsModule,
	EmployeeSelectorsModule,
	TimeTrackerModule,
	TranslateModule.forChild({
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];
const COMPONENTS = [
	HeaderComponent,
	FooterComponent,
	SearchInputComponent,
	TinyMCEComponent,
	OneColumnLayoutComponent,
	ThreeColumnsLayoutComponent,
	TwoColumnsLayoutComponent,
	ThemeSettingsComponent
];
const PIPES = [
	CapitalizePipe,
	PluralPipe,
	RoundPipe,
	TimingPipe,
	NumberWithCommasPipe,
	EvaIconsPipe
];

@NgModule({
	imports: [CommonModule, ...NB_MODULES],
	exports: [CommonModule, ...PIPES, ...COMPONENTS],
	declarations: [...COMPONENTS, ...PIPES],
	providers: [
		UsersService,
		SelectorService,
		UsersOrganizationsService,
		OrganizationsService
	]
})
export class ThemeModule {
	static forRoot(): ModuleWithProviders {
		return <ModuleWithProviders>{
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
