import { inject, NgModule } from '@angular/core';
import { ResolveFn, Routes, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { DownloadsComponent } from './downloads.component';

/**
 * The tab title, in the app's language. The app has no title strategy that translates keys, so
 * the route resolves its own title; `get` waits for the language file if it is still loading.
 * DownloadsComponent puts the previous title back when the page is left.
 */
const downloadsTitle: ResolveFn<string> = () => inject(TranslateService).get('DOWNLOADS_PAGE.TITLE');

const routes: Routes = [
	{
		path: '',
		component: DownloadsComponent,
		title: downloadsTitle
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class DownloadsRoutingModule {}
