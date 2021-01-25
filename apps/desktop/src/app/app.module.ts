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
	AlertComponent,
	ImageViewerModule,
	UpdaterModule,
	SettingsModule,
	ScreenCaptureModule,
	TimeTrackerModule,
	SetupModule
} from '../../../../libs/desktop-ui-lib/src';
import { NbCardModule, NbButtonModule } from '@nebular/theme';

@NgModule({
	declarations: [AppComponent, AlertComponent],
	imports: [
		NbLayoutModule,
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule,
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		NbThemeModule.forRoot({ name: 'default' }),
		SetupModule,
		TimeTrackerModule,
		NgxElectronModule,
		HttpClientModule,
		ScreenCaptureModule,
		SettingsModule,
		UpdaterModule,
		ImageViewerModule
	],
	providers: [AppService, HttpClientModule, NbDialogService],
	bootstrap: [AppComponent]
})
export class AppModule {}
