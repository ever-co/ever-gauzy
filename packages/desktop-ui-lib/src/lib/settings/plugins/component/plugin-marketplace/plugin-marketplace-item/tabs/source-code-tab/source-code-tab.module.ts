import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbBadgeModule, NbCardModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SourceCodeTabComponent } from './source-code-tab.component';

const routes: Routes = [
	{
		path: '',
		component: SourceCodeTabComponent
	}
];

@NgModule({
	declarations: [SourceCodeTabComponent],
	imports: [
		CommonModule,
		RouterModule.forChild(routes),
		TranslateModule,
		NbCardModule,
		NbIconModule,
		NbBadgeModule,
		NbTooltipModule
	]
})
export class SourceCodeTabModule {}
