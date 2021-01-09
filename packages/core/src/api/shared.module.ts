import { Module } from '@nestjs/common';
import { ConfigModule } from '../config';
import { SeedModule } from '../seed/seed.module';
import { ServiceModule } from '../service/service.module';

import { Resolvers } from './graphql/resolvers';

@Module({
  imports: [ConfigModule, SeedModule],
  exports: [ConfigModule],
  providers: [],
})
export class SharedModule {}

@Module({
  imports: [SharedModule, ServiceModule.forRoot()],
  providers: [...Resolvers],
  exports: [...Resolvers],
})
export class GraphqlApiModule {}
