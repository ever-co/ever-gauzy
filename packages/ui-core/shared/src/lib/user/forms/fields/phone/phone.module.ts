import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { PhoneFormInputComponent } from './phone.component';

@NgModule({
	declarations: [PhoneFormInputComponent],
	exports: [PhoneFormInputComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslatePipe, NbInputModule]
})
export class PhoneFormInputModule {}
