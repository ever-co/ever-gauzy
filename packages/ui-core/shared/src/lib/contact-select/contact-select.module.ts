import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectComponent } from './contact-select.component';

@NgModule({
	declarations: [ContactSelectComponent],
	exports: [ContactSelectComponent],
	imports: [CommonModule, FormsModule, NgSelectModule, TranslatePipe]
})
export class ContactSelectModule {}
