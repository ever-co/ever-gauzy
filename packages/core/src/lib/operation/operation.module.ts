import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Operation } from './operation.entity';
import { OperationStep } from './operation-step.entity';
import { OperationRegistry } from './operation.registry';
import { OperationService } from './operation.service';
import { TypeOrmOperationRepository } from './repository/type-orm-operation.repository';
import { TypeOrmOperationStepRepository } from './repository/type-orm-operation-step.repository';
import { MikroOrmOperationRepository } from './repository/mikro-orm-operation.repository';
import { MikroOrmOperationStepRepository } from './repository/mikro-orm-operation-step.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Operation, OperationStep]), MikroOrmModule.forFeature([Operation, OperationStep])],
	providers: [
		OperationService,
		OperationRegistry,
		TypeOrmOperationRepository,
		TypeOrmOperationStepRepository,
		MikroOrmOperationRepository,
		MikroOrmOperationStepRepository
	],
	exports: [
		OperationService,
		OperationRegistry,
		TypeOrmOperationRepository,
		TypeOrmOperationStepRepository,
		MikroOrmOperationRepository,
		MikroOrmOperationStepRepository
	]
})
export class OperationModule {}
