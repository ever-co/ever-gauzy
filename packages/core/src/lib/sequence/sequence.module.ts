import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Sequence } from './sequence.entity';
import { SequenceService } from './sequence.service';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';
import { MikroOrmSequenceRepository } from './repository/mikro-orm-sequence.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Sequence]), MikroOrmModule.forFeature([Sequence])],
	providers: [SequenceService, TypeOrmSequenceRepository, MikroOrmSequenceRepository],
	exports: [SequenceService, TypeOrmSequenceRepository, MikroOrmSequenceRepository]
})
export class SequenceModule {}
