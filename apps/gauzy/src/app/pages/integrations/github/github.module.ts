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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { BackNavigationModule } from '../../../@shared/back-navigation/back-navigation.module';
import { GithubRoutingModule } from './github-routing.module';
import { GithubComponent } from './github.component';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';
import { GithubViewComponent } from './components/view/view.component';
import { GithubSettingsComponent } from './components/settings/settings.component';
import { RepositorySelectorModule } from '../../../@shared/integrations/github';
import { DirectivesModule } from '../../../@shared/directives/directives.module';
import { ProjectSelectModule } from '../../../@shared/project-select/project-select.module';
import { PaginationV2Module } from '../../../@shared/pagination/pagination-v2/pagination-v2.module';

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
		GithubRoutingModule,
		I18nTranslateModule.forChild(),
		DirectivesModule,
		BackNavigationModule,
		PaginationV2Module,
		RepositorySelectorModule,
		ProjectSelectModule
	]
})
export class GithubModule {}
