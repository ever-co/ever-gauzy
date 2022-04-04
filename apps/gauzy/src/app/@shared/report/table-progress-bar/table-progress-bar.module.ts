import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared.module';
import { TableProgressBarComponent } from "./table-progress-bar.component";
import { NbProgressBarModule } from "@nebular/theme";

@NgModule({
	declarations: [TableProgressBarComponent],
	exports: [TableProgressBarComponent],
	imports: [
		CommonModule,
		SharedModule,
		NbProgressBarModule,
	],
})
export class TableProgressBarModule {}
