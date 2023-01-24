import {
	Controller,
	Delete,
	ForbiddenException,
	Param,
	UseGuards,
} from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { IStatus } from '@gauzy/contracts';
import { UUIDValidationPipe } from './../../shared/pipes';
import { TenantPermissionGuard } from './../../shared/guards';
import { TaskSizeService } from './size.service';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskSizeController {

	constructor(
		private readonly taskSizeService: TaskSizeService
	) {}

	/**
	 * DELETE status by id
	 *
	 * @param id
	 * @returns
	 */
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IStatus['id']
	): Promise<DeleteResult> {
		try {
			return await this.taskSizeService.delete(id);
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
