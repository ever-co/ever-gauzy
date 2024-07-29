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
import { TranslateModule } from '@ngx-translate/core';
import { ApprovalPolicyService, RequestApprovalService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { RequestApprovalMutationComponent } from './approvals-mutation.component';
import { EmployeeMultiSelectModule } from '../employee/employee-multi-select/employee-multi-select.module';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';

@NgModule({
	imports: [
		CommonModule,
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
		EmployeeMultiSelectModule,
		TagsColorInputModule,
		TranslateModule.forChild()
	],
	declarations: [RequestApprovalMutationComponent],
	providers: [RequestApprovalService, ApprovalPolicyService, Store]
})
export class RequestApprovalMutationModule {}
