import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user';
import { EmployeeModule } from './employee';
import { RoleModule } from './role';
import { OrganizationModule } from './organization';
import { IncomeModule } from './income';
import { ExpenseModule } from './expense';
import { EmployeeSettingModule } from './employee-setting';
import { CoreModule } from './core';
import { AuthModule } from './auth';
import { SeedDataService } from './core/seeds/SeedDataService';
import { UserOrganizationModule } from './user-organization';
import { EmployeeStatisticsModule } from './employee-statistics';
import { OrganizationDepartmentModule } from './organization-department';
import { OrganizationRecurringExpenseModule } from './organization-recurring-expense';
import { EmployeeRecurringExpenseModule } from './employee-recurring-expense';
import { OrganizationClients } from './organization-clients';
import { OrganizationPositions } from './organization-positions';
import { OrganizationProjects } from './organization-projects';
import { OrganizationVendors } from './organization-vendors';



@Module({
  imports: [
    RouterModule.forRoutes([
      {
        path: '',
        children: [
          { path: '/auth', module: AuthModule },
          { path: '/user', module: UserModule },
          { path: '/role', module: RoleModule },
          { path: '/organization', module: OrganizationModule },
          { path: '/income', module: IncomeModule },
          { path: '/expense', module: ExpenseModule },
          { path: '/employee', module: EmployeeModule },
          { path: '/employee-settings', module: EmployeeSettingModule },
          { path: '/employee-statistics', module: EmployeeStatisticsModule },
          { path: '/user-organization', module: UserOrganizationModule },
          {
            path: '/organization-department',
            module: OrganizationDepartmentModule
          },
          { path: '/organization-clients', module: OrganizationClients },
          { path: '/organization-positions', module: OrganizationPositions },
          { path: '/organization-projects', module: OrganizationProjects },
          { path: '/organization-vendors', module: OrganizationVendors },
          {
            path: '/organization-recurring-expense',
            module: OrganizationRecurringExpenseModule
          },
          {
            path: '/employee-recurring-expense',
            module: EmployeeRecurringExpenseModule
          }
        ]
      }
    ]),
    CoreModule,
    AuthModule,
    UserModule,
    EmployeeModule,
    EmployeeSettingModule,
    EmployeeStatisticsModule,
    RoleModule,
    OrganizationModule,
    IncomeModule,
    ExpenseModule,
    UserOrganizationModule,
    OrganizationDepartmentModule,
    OrganizationRecurringExpenseModule,
    OrganizationClients,
    OrganizationPositions,
    OrganizationProjects,
    OrganizationVendors,
    EmployeeRecurringExpenseModule
  ],
  controllers: [AppController],
  providers: [AppService, SeedDataService]
})
export class AppModule  {
}
