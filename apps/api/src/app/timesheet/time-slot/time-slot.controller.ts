import { Controller, UseGuards } from '@nestjs/common';
import { TimeSlot } from '../time-slot.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { TimeSlotService } from './time-slot.service';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('TimeSlot')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TimeSlotController extends CrudController<TimeSlot> {
	constructor(private readonly timeSlotService: TimeSlotService) {
		super(timeSlotService);
	}
}
