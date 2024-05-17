import { NgModule } from '@angular/core';
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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { RequestApprovalMutationComponent } from './approvals-mutation.component';
import { RequestApprovalService } from '../../@core/services/request-approval.service';
import { Store } from '../../@core/services/store.service';
import { EmployeeMultiSelectModule } from '../employee/employee-multi-select/employee-multi-select.module';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';

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
		EmployeeMultiSelectModule,
		TagsColorInputModule,
		TranslateModule
	],
	declarations: [RequestApprovalMutationComponent],
	providers: [RequestApprovalService, ApprovalPolicyService, Store]
})
export class RequestApprovalMutationModule {}
