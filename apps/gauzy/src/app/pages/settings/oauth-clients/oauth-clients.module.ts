import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { OAuthClientsRoutingModule } from './oauth-clients-routing.module';
import { OAuthClientsComponent } from './oauth-clients.component';
import { OAuthClientFormDialogComponent } from './oauth-client-form-dialog/oauth-client-form-dialog.component';
import { OAuthClientSecretDialogComponent } from './oauth-client-secret-dialog/oauth-client-secret-dialog.component';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NbAlertModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		OAuthClientsRoutingModule
	],
	declarations: [
		OAuthClientsComponent,
		OAuthClientFormDialogComponent,
		OAuthClientSecretDialogComponent
	]
})
export class OAuthClientsModule {}
