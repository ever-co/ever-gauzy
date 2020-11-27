import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbAuthComponent } from '@nebular/auth';
import { TermsAndConditionsComponent } from './terms-and-conditions/terms-and-conditions.component';

export const routes: Routes = [
	{
		path: 'legal',
		component: NbAuthComponent,
		children: [
			{
				path: 'terms',
				component: TermsAndConditionsComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class LegalRoutingModule {}
