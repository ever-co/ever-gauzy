import { NestModule, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '../config';
import { environment as env } from '@env-api/environment';

@Module({
    imports: [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
          ...env.database,
        //   entities,
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