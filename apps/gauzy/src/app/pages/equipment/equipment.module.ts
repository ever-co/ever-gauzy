import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { NgModule } from '@angular/core';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
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
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationModule } from '../../@shared/equipment/equipment-mutation.module';
import { EquipmentMutationComponent } from '../../@shared/equipment/equipment-mutation.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
@NgModule({
	imports: [
		EquipmentRoutingModule,
		ThemeModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		EquipmentMutationModule,
		TableComponentsModule,
		CardGridModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule
	],
	providers: [EquipmentService],
	entryComponents: [EquipmentMutationComponent, AutoApproveComponent],
	declarations: [EquipmentComponent, AutoApproveComponent]
})
export class EquipmentModule {}
