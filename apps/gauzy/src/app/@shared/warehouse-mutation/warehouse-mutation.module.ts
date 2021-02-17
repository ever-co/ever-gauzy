import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbTabsetModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeModule } from '../../@theme/theme.module';
import { LocationFormModule } from '../forms/location';
import { LeafletMapModule } from '../forms/maps/leaflet/leaflet.module';
import { ImageUploaderModule } from '../image-uploader/image-uploader.module';
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
		TagsColorInputModule,
		LocationFormModule,
		LeafletMapModule,
		NbTabsetModule,
		ImageUploaderModule
	],
	declarations: [WarehouseMutationComponent],
	entryComponents: [WarehouseMutationComponent],
	providers: []
})
export class WarehouseMutationModule {}
