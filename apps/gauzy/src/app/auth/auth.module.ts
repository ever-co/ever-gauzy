import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NgxAuthRoutingModule } from './auth-routing.module';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAlertModule,
	NbButtonModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { NgxRegisterComponent } from './register/register.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		RouterModule,
		NbAlertModule,
		NbInputModule,
		NbButtonModule,
		NbCheckboxModule,
		NgxAuthRoutingModule,
		NbAuthModule,
		NbIconModule
	],
	declarations: [NgxRegisterComponent]
})
export class NgxAuthModule {}
