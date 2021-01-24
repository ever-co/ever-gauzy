import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SetupComponent } from './setup.component';
// import { AlertComponent } from '../../@shared/dialogs/alert/alert.component';
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
	NbIconModule,
	NbStepperModule,
	NbRadioModule,
	NbProgressBarModule,
	NbFormFieldModule,
	NbDialogService,
	NbDialogModule
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
		NbEvaIconsModule,
		NbStepperModule,
		NbIconModule,
		NbRadioModule,
		NbProgressBarModule,
		NbFormFieldModule,
		NbDialogModule
	],
	exports: [SetupComponent],
	providers: [SetupService, NbDialogService]
})
export class SetupModule {}
