import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsTabComponent } from './settings-tab.component';

const routes: Routes = [
	{
		path: '',
		component: SettingsTabComponent
	}
];

@NgModule({
	declarations: [SettingsTabComponent],
	imports: [
		CommonModule,
		RouterModule.forChild(routes),
		TranslateModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbAlertModule
	]
})
export class SettingsTabModule {}
