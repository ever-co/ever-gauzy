import { inject, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbIconLibraries,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';
import { RICH_TEXT_ICON_PACK, RICH_TEXT_ICONS } from './rich-text-icons';

@NgModule({
	declarations: [RichTextEditorComponent, RichTextToolbarComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		TranslateModule
	],
	exports: [RichTextEditorComponent, RichTextToolbarComponent]
})
export class RichTextEditorModule {
	constructor() {
		// Registered here, not in the app's icon module, so the Electron apps that use
		// the editor without the global theme still get the toolbar icons
		inject(NbIconLibraries).registerSvgPack(RICH_TEXT_ICON_PACK, RICH_TEXT_ICONS);
	}
}
