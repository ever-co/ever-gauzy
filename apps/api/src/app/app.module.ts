import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { UserModule } from './user';
import { EmployeeModule } from './employee';
import { RoleModule } from './role';
import { OrganizationModule } from './organization';
import { IncomeModule } from './income';
import { ExpenseModule } from './expense';
import { EmployeeSettingsModule } from './employee-settings';

@Module({
  imports: [
    CoreModule,
    UserModule,
    EmployeeModule,
    RoleModule,
    OrganizationModule,
    IncomeModule,
    ExpenseModule,
    EmployeeSettingsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
