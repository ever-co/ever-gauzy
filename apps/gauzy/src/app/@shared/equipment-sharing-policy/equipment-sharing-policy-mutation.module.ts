import { NgModule } from '@angular/core';
import {
	NbIconModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbRadioModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { EquipmentSharingPolicyMutationComponent } from './equipment-sharing-policy-mutation.component';
import { EquipmentSharingPolicyService } from '../../@core/services/equipment-sharing-policy.service';
import { TranslaterModule } from '../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbRadioModule,
		NgSelectModule,
		TranslaterModule
	],
	declarations: [EquipmentSharingPolicyMutationComponent],
	entryComponents: [],
	providers: [EquipmentSharingPolicyService]
})
export class EquipmentSharingPolicyMutationModule {}
