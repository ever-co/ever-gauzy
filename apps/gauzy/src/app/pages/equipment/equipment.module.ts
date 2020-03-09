import { NgModule } from '@angular/core';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { EquipmentComponent } from './equipment.component';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

@NgModule({
	imports: [
		EquipmentRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		// ExpensesMutationModule,
		// UserFormsModule,
		TableComponentsModule,
		// TranslateModule.forChild({
		// 	loader: {
		// 		provide: TranslateLoader,
		// 		useFactory: HttpLoaderFactory,
		// 		deps: [HttpClient]
		// 	}
		// }),
		NbSpinnerModule
	],
	declarations: [EquipmentComponent]
})
export class EquipmentModule {}
