import { NgModule } from '@angular/core';
import { EquipmentSharingRoutingModule } from './equipment-sharing-routing.module';
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
import { EquipmentSharingComponent } from './equipment-sharing.component';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationModule } from '../../@shared/equipment/equipment-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		EquipmentSharingRoutingModule,
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
	entryComponents: [],
	declarations: [EquipmentSharingComponent]
})
export class EquipmentSharingModule {}
