import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { ServerDownPage } from './server-down.page';
import { ThemeModule } from '../@theme/theme.module';
import { NbSidebarModule, NbLayoutModule } from '@nebular/theme';
import { TranslaterModule } from '../@shared/translater/translater.module';

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
		ThemeModule,
		NbSidebarModule,
		NbLayoutModule,
		RouterModule.forChild(routes),
		TranslaterModule
	],
	declarations: [ServerDownPage]
})
export class ServerDownModule {}
