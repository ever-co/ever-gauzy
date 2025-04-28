import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TaskProjectSequence } from './project-sequence.entity';
import { TaskProjectSequenceService } from './project-sequence.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskProjectSequence]),
		MikroOrmModule.forFeature([TaskProjectSequence]),
		CqrsModule
	],
	controllers: [],
	providers: [TaskProjectSequenceService],
	exports: [TaskProjectSequenceService]
})
export class TaskProjectSequenceModule {}
