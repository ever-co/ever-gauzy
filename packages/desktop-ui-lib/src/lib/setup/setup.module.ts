import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SetupComponent } from './setup.component';
// import { AlertComponent } from '../../@shared/dialogs/alert/alert.component';
import { FormsModule } from '@angular/forms';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbDialogService,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbProgressBarModule,
	NbRadioModule,
	NbSelectModule,
	NbSpinnerModule,
	NbStepperModule,
	NbToggleModule
} from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { SslModule } from '../settings/ssl';
import { SetupService } from './setup.service';

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
		NbDialogModule,
		DesktopDirectiveModule,
		LanguageModule.forChild(),
		SslModule
	],
	exports: [SetupComponent],
	providers: [SetupService, NbDialogService]
})
export class SetupModule {}
