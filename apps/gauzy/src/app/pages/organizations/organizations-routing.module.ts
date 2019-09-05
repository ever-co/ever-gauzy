import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationsComponent } from './organizations.component';
import { EditOrganizationComponent } from './edit-organization/edit-organization.component';

const routes: Routes = [
    {
        path: '',
        component: OrganizationsComponent,
    },
    {
        path: 'edit/:id',
        component: EditOrganizationComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class OrganizationsRoutingModule {
}
