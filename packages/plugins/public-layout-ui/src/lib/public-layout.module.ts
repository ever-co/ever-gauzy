import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ROUTES, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { LanguagesEnum } from '@gauzy/contracts';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { createPublicLayoutRoutes } from './public-layout.routes';
import { PublicLayoutComponent } from './components/public-layout/public-layout.component';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule.forRoot(),
	NbUserModule
];

/*
 * Third Party Modules
 */
const THIRD_PARTY_MODULES = [
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

@NgModule({
	declarations: [PublicLayoutComponent],
	imports: [RouterModule.forChild([]), ...NB_MODULES, ...THIRD_PARTY_MODULES, ThemeModule, SharedModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createPublicLayoutRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class PublicLayoutModule {}
