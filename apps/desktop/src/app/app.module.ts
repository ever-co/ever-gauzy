import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import {
	NbDialogModule,
	NbThemeModule,
	NbToastrModule,
	NbDialogService
} from '@nebular/theme';
import { SetupModule } from './pages/setup/setup.module';
import { NgxElectronModule } from 'ngx-electron';
import { AppService } from './app.service';
import { HttpClientModule } from '@angular/common/http';
import { TimeTrackerModule } from './pages/time-tracker/time-tracker.module';
import { ScreenCaptureModule } from './pages/screen-capture/screen-capture.module';
import { SettingsModule } from './pages/settings/settings.module';
import { UpdaterModule } from './pages/updater/updater.module';
import { ImageViewerModule } from './pages/image-viewer/image-viewer.module';
import { AlertComponent } from './@shared/dialogs/alert/alert.component';
import { NbCardModule, NbButtonModule } from '@nebular/theme';

@NgModule({
	declarations: [AppComponent, AlertComponent],
	imports: [
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
		ImageViewerModule,
		NbDialogModule.forRoot(),
		NbToastrModule.forRoot(),
		NbCardModule,
		NbButtonModule
	],
	providers: [AppService, HttpClientModule, NbDialogService],
	bootstrap: [AppComponent]
})
export class AppModule {}
