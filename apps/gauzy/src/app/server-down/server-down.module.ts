import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { Routes, RouterModule } from '@angular/router';
import { ServerDownPage } from './server-down.page';
import { ThemeModule } from '../@theme/theme.module';
import { NbSidebarModule, NbLayoutModule } from '@nebular/theme';

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
		TranslateModule.forChild()
	],
	declarations: [ServerDownPage]
})
export class ServerDownModule {}
