import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from './../../../@shared/translate/translate.module';
import { GithubRoutingModule } from './github-routing.module';
import { GithubComponent } from './github.component';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';
import { GithubViewComponent } from './components/view/view.component';

@NgModule({
	declarations: [
		GithubComponent,
		GithubWizardComponent,
		GithubInstallationComponent,
		GithubViewComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		NbSpinnerModule,
		Ng2SmartTableModule,
		NgSelectModule,
		GithubRoutingModule,
		TranslateModule
	]
})
export class GithubModule { }
