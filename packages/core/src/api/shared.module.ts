import { Module } from '@nestjs/common';
import { ConfigModule } from '@gauzy/config';
import { ServiceModule } from '../service/service.module';

import { Resolvers } from './graphql/resolvers';

@Module({
	imports: [ConfigModule],
	exports: [ConfigModule],
	providers: []
})
export class SharedModule {}

@Module({
	imports: [SharedModule, ServiceModule.forRoot()],
	providers: [...Resolvers],
	exports: [...Resolvers]
})
export class GraphqlApiModule {}
