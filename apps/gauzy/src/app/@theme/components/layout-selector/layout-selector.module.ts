// import { HttpClient } from '@angular/common/http';
// import { NgModule } from '@angular/core';
// import { NbButtonModule, NbIconModule } from '@nebular/theme';
// import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
// import { TranslateHttpLoader } from '@ngx-translate/http-loader';
// import { LayoutSelectorComponent } from './layout-selector.component';

// export function HttpLoaderFactory(http: HttpClient) {
// 	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
// }

// @NgModule({
// 	imports: [
//     NbButtonModule,
//     NbIconModule,
// 		TranslateModule.forChild({
// 			loader: {
// 				provide: TranslateLoader,
// 				useFactory: HttpLoaderFactory,
// 				deps: [HttpClient]
// 			}
// 		})
// 	],
// 	exports: [LayoutSelectorComponent],
// 	declarations: [LayoutSelectorComponent],
// 	providers: []
// })
// export class LayoutSelectorModule {}
