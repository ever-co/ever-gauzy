import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationsComponent } from './organizations.component';
import { EditOrganizationSettingsComponent } from './edit-organization/edit-organization-settings/edit-organization-settings.component';
import { EditOrganizationComponent } from './edit-organization/edit-organization.component';

const routes: Routes = [
    {
        path: '',
        component: OrganizationsComponent,
    },
    {
        path: 'edit/:id',
        component: EditOrganizationComponent
    },
    {
        path: 'edit/:id/settings',
        component: EditOrganizationSettingsComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class OrganizationsRoutingModule {
}
