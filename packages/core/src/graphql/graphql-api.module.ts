import { Module } from '@nestjs/common';

import { RoleEntityResolver } from './../role/role-entity.resolver';
const Resolvers = [RoleEntityResolver];

@Module({
	imports: [],
	providers: [...Resolvers],
	exports: [...Resolvers]
})
export class GraphqlApiModule {}
