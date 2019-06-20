import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { UserModule } from './user';
import { EmployeeModule } from './employee';
import { RoleModule } from './role';
import { OrganizationModule } from './organization';

@Module({
  imports: [
    CoreModule,
    UserModule,
    EmployeeModule,
    RoleModule,
    OrganizationModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
