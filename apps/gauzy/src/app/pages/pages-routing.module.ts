import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';

import { PagesComponent } from './pages.component';
import { NotFoundComponent } from './miscellaneous/not-found/not-found.component';

const routes: Routes = [{
  path: '',
  component: PagesComponent,
  children: [
    {
      path: '',
      redirectTo: 'dashboard',
      pathMatch: 'full'
    },
    {
      path: 'dashboard',
      loadChildren: () => import('./dashboard/dashboard.module')
        .then(m => m.DashboardModule),
    },
    {
      path: 'income',
      loadChildren: () => import('./income/income.module')
        .then(m => m.IncomeModule),
    },
    {
      path: 'expenses',
      loadChildren: () => import('./expenses/expenses.module')
        .then(m => m.ExpensesModule),
    },
    {
      path: 'employees',
      loadChildren: () => import('./employees/employees.module')
        .then(m => m.EmployeesModule),
    },
    {
      path: 'organizations',
      loadChildren: () => import('./organizations/organizations.module')
        .then(m => m.OrganizationsModule),
    },
    {
      path: '**',
      component: NotFoundComponent,
    },
  ],
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {
}
