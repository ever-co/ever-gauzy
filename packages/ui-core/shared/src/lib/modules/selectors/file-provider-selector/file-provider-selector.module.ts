import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FileProviderSelectorComponent } from './file-provider-selector.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbSelectModule, TranslateModule.forChild()],
	declarations: [FileProviderSelectorComponent],
	exports: [FileProviderSelectorComponent]
})
export class FileProviderSelectorModule {}
