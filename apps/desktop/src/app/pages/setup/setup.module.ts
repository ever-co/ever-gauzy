import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SetupComponent } from './setup.component';
import { SetupService } from './setup.service';
import {
	NbLayoutModule,
	NbCardModule,
	NbToggleModule,
	NbSelectModule,
	NbInputModule,
	NbButtonModule,
	NbSpinnerModule,
	NbCheckboxModule,
	NbIconModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { NbEvaIconsModule } from '@nebular/eva-icons';
@NgModule({
	declarations: [SetupComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbToggleModule,
		NbSelectModule,
		NbInputModule,
		NbButtonModule,
		FormsModule,
		NbSpinnerModule,
		NbCheckboxModule,
		NbIconModule,
		NbEvaIconsModule
	],
	exports: [SetupComponent],
	providers: [SetupService]
})
export class SetupModule {}
