import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService,
	NbLayoutModule
} from '@nebular/theme';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import { HttpClientModule } from '@angular/common/http';
import {
	UpdaterModule,
	SettingsModule,
	SetupModule,
	ServerDashboardModule
} from '@gauzy/desktop-ui-lib';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { RouterModule } from '@angular/router';

@NgModule({
	declarations: [AppComponent],
	imports: [
		NbLayoutModule,
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule,
		BrowserModule,
		BrowserAnimationsModule,
		RouterModule,
		AppRoutingModule,
		NbThemeModule.forRoot({ name: 'default' }),
		SetupModule,
		NgxElectronModule,
		HttpClientModule,
		SettingsModule,
		UpdaterModule,
		ServerDashboardModule
	],
	providers: [AppService, HttpClientModule, NbDialogService],
	bootstrap: [AppComponent]
})
export class AppModule {}
