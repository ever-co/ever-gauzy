import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'angular2-smart-table';
import { WebhooksComponent } from './webhooks.component';

const routes: Routes = [
	{
		path: '',
		component: WebhooksComponent
	}
];

@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild(routes),
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule,
		Ng2SmartTableModule
	],
	declarations: [WebhooksComponent]
})
export class WebhooksModule { }
