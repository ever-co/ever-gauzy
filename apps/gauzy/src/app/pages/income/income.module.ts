import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbDatepickerModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbBadgeModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeService } from '../../@core/services/income.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { IncomeMutationModule } from '../../@shared/income/income-mutation/income-mutation.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { NgxPermissionsModule } from 'ngx-permissions';

@NgModule({
	imports: [
		NbBadgeModule,
		IncomeRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbDatepickerModule,
		NbIconModule,
		Ng2SmartTableModule,
		NgSelectModule,
		NbDialogModule.forChild(),
		UserFormsModule,
		IncomeMutationModule,
		TableComponentsModule,
		CardGridModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule,
		NgxPermissionsModule.forChild()
	],
	entryComponents: [],
	declarations: [IncomeComponent],
	providers: [IncomeService]
})
export class IncomeModule {}
