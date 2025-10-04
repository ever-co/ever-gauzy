import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { CustomTrackingService } from './custom-tracking.service';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotService } from '../time-slot/time-slot.service';
import { TimeLogService } from '../time-log/time-log.service';
import { ProcessTrackingDataCommand } from './commands/process-tracking-data.command';
import { IProcessTrackingDataInput } from '@gauzy/contracts';

describe('CustomTrackingService', () => {
	let service: CustomTrackingService;
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
		commandBus = module.get<CommandBus>(CommandBus);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('submitTrackingData', () => {
		it('should execute ProcessTrackingDataCommand', async () => {
			const dto = {
				payload: 'encoded_payload',
				startTime: new Date().toISOString()
			};
			const input: IProcessTrackingDataInput = {
				...dto,
				startTime: new Date(dto.startTime)
			};

			const expectedResult = {
				success: true,
				sessionId: 'test-session',
				timeSlotId: 'test-timeslot'
			};

			jest.spyOn(commandBus, 'execute').mockResolvedValue(expectedResult);

			const result = await service.submitTrackingData(input);

			expect(commandBus.execute).toHaveBeenCalledWith(expect.any(ProcessTrackingDataCommand));
			expect(result).toEqual(expectedResult);
		});
	});
});
