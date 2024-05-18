import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCheckboxModule, NbBadgeModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { EnabledStatusComponent } from './enabled-row.component';
import { IconRowComponent } from './icon-row.component';
import { ImageRowComponent } from './image-row.component';
import { ItemImgTagsComponent } from './item-img-tags-row.component';
import { SelectedRowComponent } from './selected-row.component';
import { ContactRowComponent } from './contact-row.component';
import { NameWithDescriptionComponent } from './name-with-description/name-with-description.component';
import { SharedModule } from '../../../../@shared/shared.module';
import { NoImageComponent } from './no-image/no-image.component';
import { DescriptionComponent } from './description/description.component';

@NgModule({
	declarations: [
		EnabledStatusComponent,
		IconRowComponent,
		ImageRowComponent,
		ItemImgTagsComponent,
		SelectedRowComponent,
		ContactRowComponent,
		NameWithDescriptionComponent,
		NoImageComponent,
		DescriptionComponent
	],
	imports: [NbCheckboxModule, NbBadgeModule, NbIconModule, CommonModule, TranslateModule, SharedModule],
	exports: [NoImageComponent]
})
export class InventoryTableComponentsModule {}
