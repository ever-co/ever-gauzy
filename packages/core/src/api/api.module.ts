import { Module } from '@nestjs/common';
import * as path from 'path';
import { ConfigService } from '../config';
import { ServiceModule } from '../service/service.module';
import { GraphqlApiModule, SharedModule } from './shared.module';
import { GraphqlModule } from './graphql';

@Module({
  imports: [
    ServiceModule.forRoot(),
    SharedModule,
    GraphqlApiModule,
    GraphqlModule.registerAsync((configService: ConfigService) => ({
      path: configService.graphqlConfig.path,
      playground: configService.graphqlConfig.playground,
      debug: configService.graphqlConfig.debug,
      typePaths: [path.join(__dirname, 'graphql', 'schema', '*.gql')],
      resolverModule: GraphqlApiModule,
    })),
  ],
  providers: [],
})
export class ApiModule {}
