import {NgModule} from '@angular/core';
import {EmployeeStartWorkComponent} from "./employee-start-work.component";
import {FormsModule} from "@angular/forms";
import {TranslateModule} from "../../translate/translate.module";
import {NbButtonModule, NbCardModule, NbDatepickerModule, NbIconModule, NbInputModule} from "@nebular/theme";


@NgModule({
	declarations: [EmployeeStartWorkComponent],
	exports: [EmployeeStartWorkComponent],
	imports: [
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbDatepickerModule,
		NbInputModule,
		TranslateModule
	]
})
export class EmployeeStartWorkModule {
}
