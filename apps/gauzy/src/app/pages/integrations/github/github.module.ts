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
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from './../../../@shared/translate/translate.module';
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
import { PaginationModule } from '../../../@shared/pagination/pagination.module';

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
		Ng2SmartTableModule,
		NgSelectModule,
		GithubRoutingModule,
		TranslateModule,
		DirectivesModule,
		BackNavigationModule,
		PaginationModule,
		RepositorySelectorModule,
		ProjectSelectModule
	]
})
export class GithubModule { }
