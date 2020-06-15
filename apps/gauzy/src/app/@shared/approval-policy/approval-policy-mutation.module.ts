import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
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
	NbRadioModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ThemeModule } from '../../@theme/theme.module';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/employee/employee.module';
import { ApprovalPolicyMutationComponent } from './approval-policy-mutation.component';
import { Store } from '../../@core/services/store.service';
import { NgSelectModule } from '@ng-select/ng-select';

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [ApprovalPolicyMutationComponent],
	entryComponents: [],
	providers: [ApprovalPolicyService, Store]
})
export class ApprovalPolicyMutationModule {}
