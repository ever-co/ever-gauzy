import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from './../../../@shared/translate/translate.module';
import { GithubRoutingModule } from './github-routing.module';
import { GithubWizardComponent } from './components/wizard/wizard.component';
import { GithubInstallationComponent } from './components/installation/installation.component';

@NgModule({
	declarations: [
		GithubWizardComponent,
		GithubInstallationComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		GithubRoutingModule,
		TranslateModule
	]
})
export class GithubModule { }
