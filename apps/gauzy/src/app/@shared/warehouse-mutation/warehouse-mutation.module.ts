import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeModule } from '../../@theme/theme.module';
import { TagsColorInputModule } from '../tags/tags-color-input/tags-color-input.module';
import { WarehouseMutationComponent } from './warehouse-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbIconModule,
		TranslateModule,
		NbButtonModule,
		NbInputModule,
		ThemeModule,
		TagsColorInputModule
	],
	declarations: [WarehouseMutationComponent],
	entryComponents: [WarehouseMutationComponent],
	providers: []
})
export class WarehouseMutationModule {}
