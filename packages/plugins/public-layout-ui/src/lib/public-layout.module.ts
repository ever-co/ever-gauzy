import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ROUTES, RouterModule } from '@angular/router';
import {
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule,
	NbToggleModule,
	NbTooltipModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { LanguagesEnum } from '@gauzy/contracts';
import { LanguagesService, PageRouteRegistryService, SkillsService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	AppointmentCalendarModule,
	CurrencyModule,
	ImageUploaderModule,
	InvoiceViewInnerModule,
	LanguageSelectorModule,
	ManageAppointmentModule,
	MiscellaneousModule,
	SelectorsModule,
	SharedModule,
	SkillsInputModule,
	TableComponentsModule,
	TagsColorInputModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { COMPONENTS } from './components';
import { createPublicLayoutRoutes } from './public-layout.routes';

// Nebular Modules
const NB_MODULES = [
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbSelectModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule.forRoot(),
	NbToggleModule,
	NbTooltipModule,
	NbUserModule
];

/*
 * Third Party Modules
 */
const THIRD_PARTY_MODULES = [
	CKEditorModule,
	NgSelectModule,
	NgxPermissionsModule.forRoot(),
	TranslateModule.forRoot({
		defaultLanguage: LanguagesEnum.ENGLISH,
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

/**
 * Feature Modules
 */
const FEATURE_MODULES = [
	AppointmentCalendarModule,
	CurrencyModule,
	ImageUploaderModule,
	InvoiceViewInnerModule,
	LanguageSelectorModule,
	ManageAppointmentModule,
	MiscellaneousModule,
	SelectorsModule,
	SharedModule,
	SkillsInputModule,
	TableComponentsModule,
	TagsColorInputModule,
	ThemeModule,
	WorkInProgressModule
];

@NgModule({
	declarations: [...COMPONENTS],
	imports: [RouterModule.forChild([]), ...NB_MODULES, ...THIRD_PARTY_MODULES, ...FEATURE_MODULES],
	exports: [...COMPONENTS],
	providers: [
		LanguagesService,
		SkillsService,
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createPublicLayoutRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class PublicLayoutModule {}
