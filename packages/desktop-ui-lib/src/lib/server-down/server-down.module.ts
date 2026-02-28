import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NbLayoutModule, NbSidebarModule } from '@nebular/theme';
import { LanguageModule } from '../language/language.module';
import { ServerConnectionService, Store } from '../services';

export * from './server-down.page';

const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./server-down.page').then((m) => m.ServerDownPage)
	}
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbSidebarModule,
		NbLayoutModule,
		RouterModule.forChild(routes),
		LanguageModule.forChild()
	],
	providers: [Store, ServerConnectionService]
})
export class ServerDownModule {}
