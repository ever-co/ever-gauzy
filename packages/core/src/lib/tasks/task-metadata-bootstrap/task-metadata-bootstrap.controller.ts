import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ITaskMetadataBootstrapResponse } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { UseValidationPipe } from '../../shared/pipes';
import { TaskMetadataBootstrapQueryDTO } from './dto';
import { TaskMetadataBootstrapService } from './task-metadata-bootstrap.service';

@ApiTags('Task Metadata')
@UseGuards(TenantPermissionGuard)
@Controller('/task-metadata')
export class TaskMetadataBootstrapController {
	constructor(private readonly service: TaskMetadataBootstrapService) {}

	@Get('/bootstrap')
	@UseValidationPipe({ whitelist: true, transform: true })
	bootstrap(@Query() query: TaskMetadataBootstrapQueryDTO): Promise<ITaskMetadataBootstrapResponse> {
		return this.service.bootstrap(query);
	}
}
