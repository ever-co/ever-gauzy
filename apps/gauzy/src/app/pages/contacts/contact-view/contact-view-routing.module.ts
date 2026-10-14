import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContactViewComponent } from './contact-view.component';

/**
 * `/pages/contacts/view/:id` — one contact, full width (also what a contact favorite opens).
 *
 * The route used to carry a single child that redirected `''` to `tenant`, a route that exists nowhere
 * (the component has no `<router-outlet>` either), so every visit was redirected to
 * `/pages/contacts/view/:id/tenant`, which matched nothing and fell through to the "not found" page.
 */
const routes: Routes = [
	{
		path: '',
		component: ContactViewComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ContactViewRoutingModule {}
