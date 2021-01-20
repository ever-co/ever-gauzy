import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
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
import { ApprovalPolicyMutationComponent } from './approval-policy-mutation.component';
import { Store } from '../../@core/services/store.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '../translate/translate.module';

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
		TranslateModule
	],
	declarations: [ApprovalPolicyMutationComponent],
	entryComponents: [],
	providers: [ApprovalPolicyService, Store]
})
export class ApprovalPolicyMutationModule {}
