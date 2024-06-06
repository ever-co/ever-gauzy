import { NgModule } from '@angular/core';
import {
	NbIconModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { Store } from '@gauzy/ui-sdk/common';
import { CurrencyModule } from '@gauzy/ui-sdk/shared';
import { EquipmentService, ImageAssetService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../@theme/theme.module';
import { EquipmentMutationComponent } from './equipment-mutation.component';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';

@NgModule({
	imports: [
		TagsColorInputModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		I18nTranslateModule.forChild(),
		CurrencyModule
	],
	declarations: [EquipmentMutationComponent],
	providers: [EquipmentService, ImageAssetService, Store]
})
export class EquipmentMutationModule {}
