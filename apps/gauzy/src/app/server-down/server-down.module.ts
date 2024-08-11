import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { NbSidebarModule, NbLayoutModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ServerDownPage } from './server-down.page';

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
		TranslateModule.forChild()
	],
	declarations: [ServerDownPage]
})
export class ServerDownModule {}
