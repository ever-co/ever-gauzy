import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Put,
	Param,
	Get,
	Query,
	UseGuards,
	Delete
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IManualTimeInput, TimeLog, IGetTimeLogInput } from '@gauzy/models';
import { TimeLogService } from './time-log.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('TimeLog')
@UseGuards(AuthGuard('jwt'))
@Controller('time-log')
export class TimeLogController {
	constructor(private readonly timeLogService: TimeLogService) {}

	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getLogs(@Query() entity: IGetTimeLogInput): Promise<TimeLog[]> {
		return this.timeLogService.getLogs(entity);
	}

	@ApiOperation({ summary: 'Add manual time' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/')
	async addManualTime(
		@Body() entity: IManualTimeInput,
		...options: any[]
	): Promise<TimeLog> {
		return this.timeLogService.addManualTime(entity);
	}

	@ApiOperation({ summary: 'Update time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put('/:id')
	async updateManualTime(
		@Param('id') id: string,
		@Body() entity: IManualTimeInput,
		...options: any[]
	): Promise<TimeLog> {
		entity.id = id;
		return this.timeLogService.updateManualTime(entity);
	}

	@ApiOperation({ summary: 'Delete time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Delete('/:id')
	async deleteTimeTime(@Param('id') id: string): Promise<any> {
		return this.timeLogService.deleteTimeLog(id);
	}
}
