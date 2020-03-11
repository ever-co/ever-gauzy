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
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationModule } from '../../@shared/equipment/equipment-mutation.module';
import { EquipmentMutationComponent } from '../../@shared/equipment/equipment-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
