import { NestModule, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '../config';
import { environment as env } from '@env-api/environment';

import { User } from '../user';
import { Employee } from '../employee';
import { Role } from '../role';
import { Organization } from '../organization';
import { Income } from '../income';
import { Expense } from '../expense';
import { EmployeeSettings } from '../employee-settings';

const entities = [User, Employee, Role, Organization, Income, Expense, EmployeeSettings];

@Module({
    imports: [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
          ...env.database,
          entities,
          // subscribers,
          // migrations,
        }),
        inject: [ConfigService],
      }),
    ],
    controllers: [],
    providers: [],
  })
  export class CoreModule implements NestModule {
    configure(): void {
    }
  }