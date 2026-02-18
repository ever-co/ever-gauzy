import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SetupComponent } from './setup.component';
import { FormsModule } from '@angular/forms';
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
import { TablerIconsModule } from '@gauzy/ui-core/icons';

import { LanguageModule } from '../language/language.module';
import { SslModule } from '../settings/ssl';
import { SetupService } from './setup.service';

@NgModule({
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
		TablerIconsModule,
		NbStepperModule,
		NbRadioModule,
		NbProgressBarModule,
		NbFormFieldModule,
		NbDialogModule,
		LanguageModule.forChild(),
		SslModule,
		SetupComponent
	],
	exports: [SetupComponent],
	providers: [SetupService, NbDialogService]
})
export class SetupModule {}
