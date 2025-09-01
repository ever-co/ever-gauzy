import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository } from 'typeorm';
import { CustomTrackingService } from './custom-tracking.service';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotService } from '../time-slot/time-slot.service';
import { TimeLogService } from '../time-log/time-log.service';

describe('CustomTrackingService', () => {
	let service: CustomTrackingService;
	let timeSlotRepository: Repository<TimeSlot>;
	let timeLogRepository: Repository<TimeLog>;
	let commandBus: CommandBus;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CustomTrackingService,
				{
					provide: getRepositoryToken(TimeSlot),
					useValue: {
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
						update: jest.fn(),
						createQueryBuilder: jest.fn()
					}
				},
				{
					provide: getRepositoryToken(TimeLog),
					useValue: {
						findOne: jest.fn(),
						createQueryBuilder: jest.fn()
					}
				},
				{
					provide: TimeSlotService,
					useValue: {
						update: jest.fn()
					}
				},
				{
					provide: TimeLogService,
					useValue: {}
				},
				{
					provide: CommandBus,
					useValue: {
						execute: jest.fn()
					}
				}
			]
		}).compile();

		service = module.get<CustomTrackingService>(CustomTrackingService);
		timeSlotRepository = module.get<Repository<TimeSlot>>(getRepositoryToken(TimeSlot));
		timeLogRepository = module.get<Repository<TimeLog>>(getRepositoryToken(TimeLog));
		commandBus = module.get<CommandBus>(CommandBus);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('submitTrackingData', () => {
		it('should execute ProcessTrackingDataCommand', async () => {
			const dto = {
				trackingData: 'encoded_payload',
				timestamp: new Date(),
				metadata: {}
			};

			const expectedResult = {
				success: true,
				sessionId: 'test-session',
				timeSlotId: 'test-timeslot'
			};

			jest.spyOn(commandBus, 'execute').mockResolvedValue(expectedResult);

			const result = await service.submitTrackingData(dto);

			expect(commandBus.execute).toHaveBeenCalled();
			expect(result).toEqual(expectedResult);
		});
	});
});
