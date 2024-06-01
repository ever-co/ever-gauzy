import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectComponent } from './contact-select.component';

@NgModule({
	declarations: [ContactSelectComponent],
	exports: [ContactSelectComponent],
	imports: [CommonModule, FormsModule, TranslateModule.forChild(), NgSelectModule]
})
export class ContactSelectModule {}
