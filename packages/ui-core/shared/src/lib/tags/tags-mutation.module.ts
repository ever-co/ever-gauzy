import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { ColorPickerModule } from 'ngx-color-picker';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { TagsService } from '@gauzy/ui-core/core';
import { TagsMutationComponent } from './tags-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		ColorPickerModule,
		I18nTranslateModule.forChild()
	],
	declarations: [TagsMutationComponent],
	providers: [TagsService]
})
export class TagsMutationModule {}
