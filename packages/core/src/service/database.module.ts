import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '../config';

let defaultTypeOrmModule: DynamicModule;
@Module({
  imports: [],
  exports: [],
})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    if (!defaultTypeOrmModule) {
      defaultTypeOrmModule = TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const { dbConnectionConfig } = configService.config;
          return {
            name: 'default',
            ...dbConnectionConfig,
          };
        },
        inject: [ConfigService],
      });
    }
    return {
      module: DatabaseModule,
      imports: [defaultTypeOrmModule],
    };
  }
}
