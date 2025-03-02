
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbDialogService,
	NbLayoutModule,
	NbMenuModule,
	NbSidebarModule,
	NbThemeModule,
	NbToastrModule,
	NbLayoutDirectionService
} from '@nebular/theme';
import {
	AboutModule,
	GAUZY_ENV,
	LanguageModule,
	LoggerService,
	ElectronService,
	NgxDesktopThemeModule
} from '@gauzy/desktop-ui-lib';
import { environment as gauzyEnvironment } from '@gauzy/ui-config';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app.routes';
import { AppComponent } from './app.component';
import { AppService } from './app.service';

@NgModule({
	declarations: [AppComponent],
    bootstrap: [AppComponent],
	imports: [
		NbThemeModule,
		NbLayoutModule,
        NbDialogModule.forRoot(),
        NbToastrModule.forRoot(),
        NbCardModule,
        NbButtonModule,
        BrowserModule,
        BrowserAnimationsModule,
        RouterModule,
        AppRoutingModule,
		NgxDesktopThemeModule,
        NbMenuModule.forRoot(),
        NbSidebarModule.forRoot(),
        AboutModule,
        LanguageModule.forRoot()
	],
	providers: [
        AppService,
        NbDialogService,
        LoggerService,
		ElectronService,
		NbLayoutDirectionService,
        {
            provide: APP_INITIALIZER,
            useFactory: () => () => { },
            deps: [],
            multi: true
        },
        {
            provide: GAUZY_ENV,
            useValue: {
                ...gauzyEnvironment,
                ...environment
            }
        },
        provideHttpClient(withInterceptorsFromDi())
    ]
})
export class AppModule {}
