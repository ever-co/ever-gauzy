import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PipelineController } from './pipeline.controller';
import { PipelineResolver } from './pipeline.resolver';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { DealModule } from '../deal/deal.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { TypeOrmPipelineRepository } from './repository/type-orm-pipeline.repository';
import { MikroOrmPipelineRepository } from './repository/mikro-orm-pipeline.repository';

/**
 * The sales pipeline.
 *
 * The resolver is declared here, beside the service it calls: a resolver is an ordinary Nest provider
 * and can only inject what the module hosting it can reach. It injects `PipelineService` and nothing
 * else — the deal connection it answers with is a *type* of the schema rather than a provider, so no
 * import of the deal module is added for it beyond the one the pipeline service already needs.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Pipeline]),
		MikroOrmModule.forFeature([Pipeline]),
		StageModule,
		DealModule,
		RolePermissionModule,
		UserModule
	],
	controllers: [PipelineController],
	providers: [
		PipelineService,
		// The GraphQL view of the same resource.
		PipelineResolver,
		TypeOrmPipelineRepository,
		MikroOrmPipelineRepository
	]
})
export class PipelineModule {}