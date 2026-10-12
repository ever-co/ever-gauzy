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
import { TranslatePipe } from '@ngx-translate/core';
import { ApprovalPolicyService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';
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
		TranslatePipe
	],
	declarations: [ApprovalPolicyMutationComponent],
	providers: [ApprovalPolicyService, Store]
})
export class ApprovalPolicyMutationModule {}
