import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	NbActionsModule,
	NbButtonModule,
	NbCalendarKitModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	SelectorsModule,
	SharedModule,
	TableComponentsModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { IntegrationMakeComRoutes } from './integration-make-com.routes';
import { AuthorizationComponent } from './components/make-com-authorize/make-com-authorize.component';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';

@NgModule({
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbCalendarKitModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(),
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationMakeComRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule
	],
	declarations: [IntegrationMakeComLayoutComponent, AuthorizationComponent]
})
export class IntegrationMakeComUiModule {}
