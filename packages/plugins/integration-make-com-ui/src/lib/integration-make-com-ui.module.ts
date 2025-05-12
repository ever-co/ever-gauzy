import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';
import { integrationMakeComRoutes } from './integration-make-com.routes';

@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild(integrationMakeComRoutes),
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [
		IntegrationMakeComLayoutComponent
	]
})
export class IntegrationMakeComUIModule { }
