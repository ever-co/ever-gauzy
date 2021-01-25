import { Module } from '@nestjs/common';
import { ConfigModule } from '@gauzy/config';
import { ServiceModule } from './service.module';

import { RoleEntityResolver } from '../app/role/role-entity.resolver';

const Resolvers = [RoleEntityResolver];

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
