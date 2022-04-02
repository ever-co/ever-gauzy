import { NgModule } from "@angular/core";
import { ReportTableUserAvatarComponent } from "./report-table-user-avatar.component";
import { CommonModule } from "@angular/common";
import { SharedModule } from "../../shared.module";


@NgModule({
	declarations: [ReportTableUserAvatarComponent],
	exports: [ReportTableUserAvatarComponent],
	imports: [
		CommonModule,
		SharedModule
	]
})

export class ReportTableUserAvatarModule{}