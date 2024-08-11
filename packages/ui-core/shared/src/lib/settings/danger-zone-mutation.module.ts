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
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, IncomeService, RoleService } from '@gauzy/ui-core/core';
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
		TranslateModule.forChild()
	],
	exports: [DangerZoneMutationComponent],
	declarations: [DangerZoneMutationComponent],
	providers: [AuthService, RoleService, IncomeService]
})
export class DangerZoneMutationModule {}
