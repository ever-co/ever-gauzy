import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbIconModule,
	NbDatepickerModule,
	NbCheckboxModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { ThemeModule } from '../../@theme/theme.module';
import { InvoicesMutationComponent } from './invoices-mutation.component';
import { HttpClient } from '@angular/common/http';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/employee/employee.module';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { InvoicesService } from '../../@core/services/invoices.service';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbCheckboxModule,
		NbDatepickerModule,
		NbSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	entryComponents: [InvoicesMutationComponent],
	declarations: [InvoicesMutationComponent],
	providers: [OrganizationsService, InvoicesService]
})
export class InvoicesMutationModule {}
