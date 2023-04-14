import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { ServerDownPage } from './server-down.page';
import { NbSidebarModule, NbLayoutModule } from '@nebular/theme';
import { ServerConnectionService, Store } from '../services';

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
		RouterModule.forChild(routes)
	],
	declarations: [ServerDownPage],
	providers: [Store, ServerConnectionService]
})
export class ServerDownModule { }
