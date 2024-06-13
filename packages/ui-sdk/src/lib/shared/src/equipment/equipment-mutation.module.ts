import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { Store } from '@gauzy/ui-sdk/common';
import { EquipmentService, ImageAssetService } from '@gauzy/ui-sdk/core';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';
import { CurrencyModule } from '../modules/currency/currency.module';
import { EquipmentMutationComponent } from './equipment-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		I18nTranslateModule.forChild(),
		TagsColorInputModule,
		CurrencyModule
	],
	declarations: [EquipmentMutationComponent],
	providers: [EquipmentService, ImageAssetService, Store]
})
export class EquipmentMutationModule {}
