import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	TranslateLoader,
	TranslateModule,
	TranslateService,
} from '@ngx-translate/core';
import { HttpLoaderFactory } from '../ngx-translate';
import { HttpClient } from '@angular/common/http';
import { configureTranslate } from './ngx-translate.config';

@NgModule({
	declarations: [],
	imports: [
		CommonModule,
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			},
		}),
	],
	providers: [
		{
			provide: APP_INITIALIZER,
			useFactory: configureTranslate,
			deps: [TranslateService],
			multi: true,
		},
	],
	exports: [TranslateModule],
})
export class NgxTranslateModule { }
