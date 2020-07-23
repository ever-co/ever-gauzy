import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import {
	NbIconModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbRadioModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/employee/employee.module';
import { Store } from '../../@core/services/store.service';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { EquipmentSharingMutationComponent } from './equipment-sharing-mutation.component';
import { EquipmentService } from '../../@core/services/equipment.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbDatepickerModule,
		NgSelectModule,
		NbRadioModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [EquipmentSharingMutationComponent],
	entryComponents: [],
	providers: [
		EquipmentSharingService,
		Store,
		EquipmentService,
		ApprovalPolicyService
	]
})
export class EquipmentSharingMutationModule {}
