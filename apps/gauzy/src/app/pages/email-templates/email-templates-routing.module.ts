import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { EmailTemplatesComponent } from './email-templates.component';

const routes: Routes = [
	{
		path: '',
		component: EmailTemplatesComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmailTemplatesRoutingModule {}
