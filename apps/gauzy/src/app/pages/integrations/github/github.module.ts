import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { PaginationV2Module, ProjectSelectModule, RepositorySelectorModule, SharedModule } from '@gauzy/ui-core/shared';
import { GithubRoutingModule } from './github-routing.module';
import { GithubComponent } from './github.component';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';
import { GithubViewComponent } from './components/view/view.component';
import { GithubSettingsComponent } from './components/settings/settings.component';

@NgModule({
	declarations: [
		GithubComponent,
		GithubWizardComponent,
		GithubInstallationComponent,
		GithubViewComponent,
		GithubSettingsComponent
	],
	imports: [
		CommonModule,
		GithubRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbPopoverModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		Angular2SmartTableModule,
		NgSelectModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		PaginationV2Module,
		RepositorySelectorModule,
		ProjectSelectModule
	]
})
export class GithubModule {}
