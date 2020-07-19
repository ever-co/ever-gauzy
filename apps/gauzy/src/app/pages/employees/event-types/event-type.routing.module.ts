import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EventTypeComponent } from './event-type.component';
const routes: Routes = [
	{
		path: '',
		component: EventTypeComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EventTypeRoutingModule {}
