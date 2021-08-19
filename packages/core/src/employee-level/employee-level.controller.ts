import {
	Controller,
	Get,
	Param,
	UseGuards,
	Query,
	Body,
	Put,
	BadRequestException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IEmployeeLevel, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { EmployeeLevel } from './employee-level.entity';
import { EmployeeLevelService } from './employee-level.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('EmployeeLevel')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmployeeLevelController extends CrudController<EmployeeLevel> {
	constructor(
		private readonly employeeLevelService: EmployeeLevelService
	) {
		super(employeeLevelService);
	}

	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any,
	): Promise<IPagination<IEmployeeLevel>> {
		const { relations, findInput } = data;
		return await this.employeeLevelService.findAll({
			where: {
				...findInput
			},
			relations
		});
	}

	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: EmployeeLevel,
		...options: any[]
	): Promise<IEmployeeLevel> {
		try {
			return this.employeeLevelService.create({
				id,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
