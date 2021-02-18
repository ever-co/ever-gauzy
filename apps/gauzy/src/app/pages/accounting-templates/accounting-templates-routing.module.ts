import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { AccountingTemplatesComponent } from './accounting-templates.component';

const routes: Routes = [
	{
		path: '',
		component: AccountingTemplatesComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AccountingTemplatesRoutingModule {}
