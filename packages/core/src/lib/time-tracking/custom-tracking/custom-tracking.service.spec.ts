/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the subject first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { CustomTrackingService } from './custom-tracking.service';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotService } from '../time-slot/time-slot.service';
import { TimeLogService } from '../time-log/time-log.service';
import { ProcessTrackingDataCommand } from './commands/process-tracking-data.command';
import { ProcessTrackingDataDTO } from './dto/process-tracking-data.dto';
import { ID } from '@gauzy/contracts';
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
		})
			/**
			 * The explicit providers above cover the collaborators these tests actually drive.
			 * `CustomTrackingService` also injects several ORM repositories the suite never listed
			 * (`TypeOrmTimeSlotRepository` and friends), so Nest could not construct it. Automock
			 * whatever is left rather than enumerating every repository, which would have to be
			 * updated on each constructor change without testing anything more.
			 */
			.useMocker(() => ({}))
			.compile();
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
			/**
			 * `submitTrackingData` takes `ProcessTrackingDataDTO`, and its base
			 * `TenantOrganizationBaseDTO` declares `organization` / `organizationId` as REQUIRED
			 * TypeScript properties even though `@ValidateIf` makes them mutually optional at
			 * runtime (either one — or `sentTo` — satisfies validation). Typing this fixture as the
			 * looser `IProcessTrackingDataInput` therefore did not type-check, and that single error
			 * stopped the entire suite from compiling. Supply the organization id a caller really
			 * sends and assert against the DTO shape the method actually accepts.
			 */
			const input = {
				...dto,
				startTime: new Date(dto.startTime),
				organizationId: 'aaaaaaaa-1111-4111-8111-111111111111' as ID
			} as ProcessTrackingDataDTO;
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
