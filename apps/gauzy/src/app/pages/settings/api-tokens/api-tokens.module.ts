import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRadioModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ApiTokenFormDialogComponent } from './api-token-form-dialog/api-token-form-dialog.component';
import { ApiTokenSecretDialogComponent } from './api-token-secret-dialog/api-token-secret-dialog.component';
import { ApiTokensRoutingModule } from './api-tokens-routing.module';
import { ApiTokensComponent } from './api-tokens.component';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		TranslatePipe,
		ApiTokensRoutingModule,
		SharedModule
	],
	declarations: [ApiTokensComponent, ApiTokenFormDialogComponent, ApiTokenSecretDialogComponent]
})
export class ApiTokensModule {}
