import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbToastrModule,
	NbListModule
} from '@nebular/theme';
import { AuthService } from '../../@core/services/auth.service';
import { RoleService } from '../../@core/services/role.service';
import { IncomeService } from '../../@core/services/income.service';
import { DangerZoneMutationComponent } from './danger-zone-mutation/danger-zone-mutation.component';
import { TranslaterModule } from '../translater/translater.module';

@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbDatepickerModule,
		NbSelectModule,
		NbToastrModule,
		NbListModule,
		TranslaterModule
	],
	exports: [DangerZoneMutationComponent],
	declarations: [DangerZoneMutationComponent],
	entryComponents: [DangerZoneMutationComponent],
	providers: [AuthService, RoleService, IncomeService]
})
export class DangerZoneMutationModule {}
