import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbIconModule,
	NbCheckboxModule,
	NbTooltipModule
} from '@nebular/theme';
import { TagsService } from '../../@core/services/tags.service';
import { ThemeModule } from '../../@theme/theme.module';
import { TagsMutationComponent } from './tags-mutation.component';
import { ColorPickerModule } from 'ngx-color-picker';
import { TranslaterModule } from '../translater/translater.module';

@NgModule({
	imports: [
		NbTooltipModule,
		NbCheckboxModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		ColorPickerModule,
		TranslaterModule
	],
	declarations: [TagsMutationComponent],
	entryComponents: [TagsMutationComponent],
	providers: [TagsService]
})
export class TagsMutationModule {}
