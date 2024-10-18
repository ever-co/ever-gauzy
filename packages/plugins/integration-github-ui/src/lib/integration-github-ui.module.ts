import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbPopoverModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	ProjectSelectModule,
	RepositorySelectorModule,
	SharedModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { IntegrationGithubRoutes } from './integration-github.routes';
import { IntegrationGithubLayoutComponent } from './integration-github.layout.component';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';
import { GithubViewComponent } from './components/view/view.component';
import { GithubSettingsComponent } from './components/settings/settings.component';

@NgModule({
	declarations: [
		IntegrationGithubLayoutComponent,
		GithubWizardComponent,
		GithubInstallationComponent,
		GithubViewComponent,
		GithubSettingsComponent
	],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbPopoverModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		NgSelectModule,
		NgxPermissionsModule.forRoot(),
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationGithubRoutes,
		SharedModule,
		SmartDataViewLayoutModule,
		RepositorySelectorModule,
		ProjectSelectModule
	]
})
export class IntegrationGithubUiModule {}
