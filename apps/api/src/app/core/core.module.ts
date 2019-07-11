// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { NestModule, Module, MiddlewareConsumer } from '@nestjs/common';
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
import { RequestContextMiddleware } from './context';
import { UserOrganization } from '../user-organization';

const entities = [User, Employee, Role, Organization, Income, Expense, EmployeeSettings, UserOrganization];

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
    configure(consumer: MiddlewareConsumer) {
      consumer.apply(RequestContextMiddleware).forRoutes('*');
    }
  }