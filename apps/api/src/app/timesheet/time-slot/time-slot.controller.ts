import {
	Controller,
	UseGuards,
	Get,
	Query,
	HttpStatus,
	Delete,
	Param
} from '@nestjs/common';
import { TimeSlot } from '../time-slot.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { TimeSlotService } from './time-slot.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IGetTimeSlotInput } from '@gauzy/models';

@ApiTags('TimeSlot')
@UseGuards(AuthGuard('jwt'))
@Controller('time-slot')
export class TimeSlotController extends CrudController<TimeSlot> {
	constructor(private readonly timeSlotService: TimeSlotService) {
		super(timeSlotService);
	}

	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getAll(@Query() entity: IGetTimeSlotInput): Promise<TimeSlot[]> {
		return this.timeSlotService.getTimeSlots(entity);
	}

	@ApiOperation({ summary: 'Delete TimeSlot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Delete('/')
	async deleteTimeSlot(@Query() { ids }) {
		return this.timeSlotService.deleteTimeSlot(ids);
	}
}
