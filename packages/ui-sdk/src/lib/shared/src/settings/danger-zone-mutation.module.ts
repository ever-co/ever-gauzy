import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbToastrModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AuthService, IncomeService, RoleService } from '@gauzy/ui-sdk/core';
import { DangerZoneMutationComponent } from './danger-zone-mutation/danger-zone-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbToastrModule,
		I18nTranslateModule.forChild()
	],
	exports: [DangerZoneMutationComponent],
	declarations: [DangerZoneMutationComponent],
	providers: [AuthService, RoleService, IncomeService]
})
export class DangerZoneMutationModule {}
