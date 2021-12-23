import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NbSelectModule } from '@nebular/theme';
import { RoleSelectComponent } from './role-select.component';

@NgModule({
	declarations: [
		RoleSelectComponent
	],
	exports: [
		RoleSelectComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		TranslateModule
	]
})
export class RoleSelectModule {}
