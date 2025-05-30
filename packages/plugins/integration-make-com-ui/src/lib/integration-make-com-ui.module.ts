import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
	NbSpinnerModule,
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
import { MakeComponent } from './components/make/make.component';
import { MakeComCallbackComponent } from './components/make-com-callback/make-com-callback.component';
import { MakeComSettingsComponent } from './components/make-com-settings/make-com-settings.component';

@NgModule({
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbSpinnerModule,
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
		TranslateModule.forChild({
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
		TableComponentsModule,
		CommonModule
	],
	declarations: [
		IntegrationMakeComLayoutComponent,
		MakeComponent,
		AuthorizationComponent,
		MakeComCallbackComponent,
		MakeComSettingsComponent
	]
})
export class IntegrationMakeComUiModule {}
