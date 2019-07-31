import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeesComponent } from './employees.component';
import { EditEmployeeComponent } from './edit-employee/edit-employee.component';
import { EditEmployeeProfileComponent } from './edit-employee/edit-employee-profile/edit-employee-profile.component';

const routes: Routes = [
    {
        path: '',
        component: EmployeesComponent,
    },
    {
        path: 'edit/:id',
        component: EditEmployeeComponent
    },
    {
        path: 'edit/:id/profile',
        component: EditEmployeeProfileComponent
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class EmployeesRoutingModule {
}
