import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { Sequence } from './sequence.entity';
import { SequenceService } from './sequence.service';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';
import { MikroOrmSequenceRepository } from './repository/mikro-orm-sequence.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Sequence]),
		MikroOrmModule.forFeature([Sequence]),
		// The allocation claims the caller's idempotency key through the kernel's own store, so this
		// module has to reach the service that owns the row: Nest imports are not inherited downwards.
		IdempotencyModule
	],
	providers: [SequenceService, TypeOrmSequenceRepository, MikroOrmSequenceRepository],
	exports: [SequenceService, TypeOrmSequenceRepository, MikroOrmSequenceRepository]
})
export class SequenceModule {}
