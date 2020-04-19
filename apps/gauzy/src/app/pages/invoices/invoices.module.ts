import { NgModule } from '@angular/core';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbTooltipModule,
	NbDatepickerModule,
	NbRadioModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { InvoicesValueComponent } from './invoices-value.component';
import { InvoiceAddComponent } from './invoice-add/invoice-add.component';
import { InvoiceTasksSelectorComponent } from './table-components/invoice-tasks-selector.component';
import { InvoiceProjectsSelectorComponent } from './table-components/invoice-project-selector.component';
import { InvoicesComponent } from './invoices.component';
import { InvoicesRoutingModule } from './invoices-routing.module';
import { InvoicesService } from '../../@core/services/invoices.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { TasksService } from '../../@core/services/tasks.service';
import { OrganizationClientsService } from '../../@core/services/organization-clients.service ';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { InvoiceEmployeesSelectorComponent } from './table-components/invoice-employees-selector.component';
import { EmployeesService } from '../../@core/services/employees.service';
import { InvoiceEditComponent } from './invoice-edit/invoice-edit.component';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		InvoicesRoutingModule,
		NbCardModule,
		NbSpinnerModule,
		NbIconModule,
		NbButtonModule,
		Ng2SmartTableModule,
		FormsModule,
		NbBadgeModule,
		ReactiveFormsModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		ThemeModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbTooltipModule,
		NbRadioModule,
		EmployeeMultiSelectModule,
		UserFormsModule,
		NbDatepickerModule,
		NgSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [
		InvoicesService,
		OrganizationsService,
		InvoiceItemService,
		TasksService,
		OrganizationClientsService,
		OrganizationProjectsService,
		EmployeesService
	],
	entryComponents: [
		InvoicesComponent,
		InvoicesValueComponent,
		InvoiceAddComponent,
		InvoiceTasksSelectorComponent,
		InvoiceProjectsSelectorComponent,
		InvoiceEmployeesSelectorComponent,
		InvoiceEditComponent
	],
	declarations: [
		InvoicesComponent,
		InvoicesValueComponent,
		InvoiceAddComponent,
		InvoiceTasksSelectorComponent,
		InvoiceProjectsSelectorComponent,
		InvoiceEmployeesSelectorComponent,
		InvoiceEditComponent
	]
})
export class InvoicesModule {}
