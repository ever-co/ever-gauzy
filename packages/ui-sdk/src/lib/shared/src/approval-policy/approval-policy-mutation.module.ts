import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbRadioModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ApprovalPolicyService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { ApprovalPolicyMutationComponent } from './approval-policy-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbIconModule,
		NbCheckboxModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbRadioModule,
		NgSelectModule,
		I18nTranslateModule.forChild()
	],
	declarations: [ApprovalPolicyMutationComponent],
	providers: [ApprovalPolicyService, Store]
})
export class ApprovalPolicyMutationModule {}
