import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NgxAuthRoutingModule } from './auth-routing.module';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { NgxRegisterComponent } from './register/register.component';
import { NgxLoginComponent } from './login/login.component';

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
		NbIconModule,
		NbCardModule
	],
	declarations: [NgxRegisterComponent, NgxLoginComponent]
})
export class NgxAuthModule {}
