import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Knex as KnexConnection } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import { TypeOrmTaskProjectSequenceRepository, MikroOrmTaskProjectSequenceRepository } from './repository';
import { TaskProjectSequence } from './project-sequence.entity';
import { CrudService } from '../../core/crud';

@Injectable()
export class TaskProjectSequenceService extends CrudService<TaskProjectSequence> {
	constructor(
		@InjectRepository(TaskProjectSequence)
		readonly typeOrmTaskProjectSequenceRepository: TypeOrmTaskProjectSequenceRepository,

		readonly mikroOrmTaskProjectSequenceRepository: MikroOrmTaskProjectSequenceRepository,

		@InjectConnection()
		readonly knexConnection: KnexConnection
	) {
		super(typeOrmTaskProjectSequenceRepository, mikroOrmTaskProjectSequenceRepository);
	}

	async getTaskNumber(projectId: string): Promise<number> {
		const queryRunner = this.typeOrmTaskProjectSequenceRepository.manager.connection.createQueryRunner();
		await queryRunner.startTransaction();

		try {
			let projectTaskSequence = await queryRunner.manager.findOne(TaskProjectSequence, {
				where: { projectId },
				lock: { mode: 'pessimistic_write' }
			});
			let taskNumber = 1;

			if (!projectTaskSequence) {
				// If the current project task sequence doesn't exist, create a new one
				projectTaskSequence = queryRunner.manager.create(TaskProjectSequence, {
					projectId,
					taskNumber
				});
			} else {
				// If the current project task sequence exists, increment the task number
				projectTaskSequence.taskNumber += 1;
				taskNumber = projectTaskSequence.taskNumber;
			}

			// Save the project task sequence
			await queryRunner.manager.save(projectTaskSequence);
			await queryRunner.commitTransaction();

			return taskNumber;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}
