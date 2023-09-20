import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from './../../../../@shared/translate/translate.module';
import { GithubRoutingModule } from './github-routing.module';
import { GithubAuthorizationComponent } from './components/authorization/authorization.component';
import { GithubInstallationsComponent } from './components/installations/installations.component';

@NgModule({
	declarations: [
		GithubAuthorizationComponent,
		GithubInstallationsComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		GithubRoutingModule,
		TranslateModule
	]
})
export class GithubModule { }
