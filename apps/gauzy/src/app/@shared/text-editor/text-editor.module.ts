import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { CKEditorModule } from 'ng2-ckeditor';

import { ThemeModule } from '../../@theme/theme.module';
import { CKEditorComponent } from './ckeditor.component';

@NgModule({
	imports: [NbCardModule, ThemeModule, CKEditorModule],
	declarations: [CKEditorComponent],
	exports: [CKEditorComponent]
})
export class TextEditorModule {}
