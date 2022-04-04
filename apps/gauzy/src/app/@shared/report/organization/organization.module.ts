import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared.module';
import { OrganizationComponent } from "./organization.component";
import { TranslateModule } from "@ngx-translate/core";

@NgModule({
	declarations: [OrganizationComponent],
	exports: [OrganizationComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
	],
})
export class OrganizationModule {}
