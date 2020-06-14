import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { NbThemeModule } from '@nebular/theme';
import { SetupModule } from './pages/setup/setup.module';
import { NgxElectronModule } from 'ngx-electron';

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		NbThemeModule.forRoot({ name: 'default' }),
		SetupModule,
		NgxElectronModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule {}
