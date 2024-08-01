import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NbLayoutModule, NbSidebarModule } from '@nebular/theme';
import { LanguageModule } from '../language/language.module';
import { ServerConnectionService, Store } from '../services';
import { ServerDownPage } from './server-down.page';

export * from './server-down.page';

const routes: Routes = [
	{
		path: '',
		component: ServerDownPage
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
	declarations: [ServerDownPage],
	providers: [Store, ServerConnectionService]
})
export class ServerDownModule {}
