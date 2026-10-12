import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { CountryComponent } from './country.component';

@NgModule({
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, TranslatePipe],
	declarations: [CountryComponent],
	exports: [CountryComponent]
})
export class CountryModule {}
