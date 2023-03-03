import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { FileProviderComponent } from './file-provider.component';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	declarations: [FileProviderComponent],
	exports: [FileProviderComponent],
	imports: [CommonModule, FormsModule, NbSelectModule, TranslateModule]
})
export class FileProviderModule {}
