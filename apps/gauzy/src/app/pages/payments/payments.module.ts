import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NgModule } from '@angular/core';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { PaymentsComponent } from './payments.component';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbSpinnerModule,
	NbBadgeModule,
	NbCheckboxModule,
	NbDialogModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbTooltipModule,
	NbRadioModule,
	NbDatepickerModule,
	NbToggleModule,
	NbContextMenuModule,
	NbMenuModule,
	NbTabsetModule
} from '@nebular/theme';
import { PaymentsRoutingModule } from './payments-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { PaymentService } from '../../@core/services/payment.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { ThemeModule } from '../../@theme/theme.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { InvoicesRoutingModule } from '../invoices/invoices-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { InvoicesService } from '../../@core/services/invoices.service';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbCardModule,
		PaymentsRoutingModule,
		Ng2SmartTableModule,
		CardGridModule,
		ThemeModule,
		NbIconModule,
		NbButtonModule,
		NbDialogModule.forChild()
	],
	providers: [PaymentService, OrganizationContactService, InvoicesService],
	entryComponents: [PaymentsComponent],
	declarations: [PaymentsComponent]
})
export class PaymentsModule {}
