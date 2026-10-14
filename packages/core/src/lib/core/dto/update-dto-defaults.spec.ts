import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { PartialType as MappedPartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional, IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsInt, IsOptional, IsString } from 'class-validator';
import { UpdateOrganizationProjectModuleDTO } from '../../organization-project-module/dto/update-organization-project-module.dto';
import { UpdateOrganizationProjectDTO } from '../../organization-project/dto/update-organization-project.dto';
import { UpdateOrganizationSprintDTO } from '../../organization-sprint/dto/update-organization-sprint.dto';
import { UpdateOrganizationTeamDTO } from '../../organization-team/dto/update-organization-team.dto';
import { UpdateTimesheetStatusDTO } from '../../time-tracking/timesheet/dto/query/update-timesheet-status.dto';
import { WithoutInitializers } from '@gauzy/common';

/**
 * `WithoutInitializers` (review R3-04): an update body built from a DTO with field defaults starts empty, and keeps
 * every bit of validation, transformation and OpenAPI metadata the DTO it extends declares.
 *
 * The mapped types' constructor copies every field initializer of the DTO it maps, and a `ValidationPipe` builds the
 * body with that constructor - with `transform: true` the handler receives the instance, and with it off but any
 * validator option set (`whitelist`) the pipe returns `classToPlain(instance)`, defaults included. The core bodies
 * below are the ones the gate (`tools/scripts/update-dto-initializer-check.mjs`) measured: a partial
 * `PUT /organization-team/:id` wrote `projects: []` back (clearing the team's projects) and a partial
 * `PUT /organization-project-modules/:id` handed the service `memberIds: []` and `managerIds: []`, which it reads as
 * "replace the members with none".
 */
class ItemDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly name: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isEnabled: boolean = true;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly priority: number = 0;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	readonly startsAt?: Date;

	readonly tags?: string[] = [];
}

class UpdateItemDTO extends WithoutInitializers(PartialType(ItemDTO)) {}

/** A default the update class states itself is the update class's decision, and it is kept. */
class UpdateItemWithOwnDefaultDTO extends WithoutInitializers(PartialType(ItemDTO)) {
	readonly reason?: string = 'edited';
}

const transformPipe = new ValidationPipe({ transform: true, whitelist: true });
const whitelistPipe = new ValidationPipe({ whitelist: true });

async function through(pipe: ValidationPipe, metatype: ArgumentMetadata['metatype'], body: Record<string, unknown>) {
	return pipe.transform({ ...body }, { type: 'body', metatype });
}

describe('WithoutInitializers', () => {
	it('the plain mapped types copy the parent defaults (the defect this exists for)', () => {
		expect({ ...new (PartialType(ItemDTO))() }).toEqual({ isEnabled: true, priority: 0, tags: [] });
		expect({ ...new (MappedPartialType(ItemDTO))() }).toEqual({ isEnabled: true, priority: 0, tags: [] });
	});

	it('builds an instance that starts empty, whatever the mapped type', () => {
		expect({ ...new UpdateItemDTO() }).toEqual({});
		expect({ ...new (WithoutInitializers(MappedPartialType(ItemDTO)))() }).toEqual({});
		expect({ ...new (WithoutInitializers(PickType(ItemDTO, ['isEnabled'] as const)))() }).toEqual({});
		expect({ ...new (WithoutInitializers(OmitType(ItemDTO, ['name'] as const)))() }).toEqual({});
		expect({ ...new (WithoutInitializers(IntersectionType(ItemDTO, ItemDTO)))() }).toEqual({});
		expect({ ...new (WithoutInitializers(ItemDTO))() }).toEqual({});
	});

	it('keeps a default the update class declares itself', () => {
		expect({ ...new UpdateItemWithOwnDefaultDTO() }).toEqual({ reason: 'edited' });
	});

	it('is still the class it extends', () => {
		const Partial = PartialType(ItemDTO);
		const Stripped = WithoutInitializers(Partial);

		expect(new Stripped()).toBeInstanceOf(Partial);
		expect(Stripped.name).toBe(Partial.name);
	});

	it('hands the handler exactly what was sent, with transform on and with whitelist alone', async () => {
		expect({ ...(await through(transformPipe, UpdateItemDTO, { name: 'renamed' })) }).toEqual({ name: 'renamed' });
		expect(await through(whitelistPipe, UpdateItemDTO, { name: 'renamed' })).toEqual({ name: 'renamed' });
		expect(await through(whitelistPipe, PartialType(ItemDTO), { name: 'renamed' })).toEqual({
			name: 'renamed',
			isEnabled: true,
			priority: 0
		});
	});

	it('keeps the validation and transformation metadata of the class it extends', async () => {
		await expect(through(transformPipe, UpdateItemDTO, { priority: 'high' })).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(through(transformPipe, UpdateItemDTO, { isEnabled: 'yes' })).rejects.toBeInstanceOf(
			BadRequestException
		);

		const result = (await through(transformPipe, UpdateItemDTO, { startsAt: '2026-10-14T00:00:00.000Z' })) as {
			startsAt: Date;
		};
		expect(result.startsAt).toBeInstanceOf(Date);
	});

	it('keeps the OpenAPI properties of the class it extends', () => {
		// `@nestjs/swagger`'s metadata keys (`DECORATORS` in its `dist/constants`, which is ESM and not importable
		// from a spec here).
		const DECORATORS = {
			API_MODEL_PROPERTIES: 'swagger/apiModelProperties',
			API_MODEL_PROPERTIES_ARRAY: 'swagger/apiModelPropertiesArray'
		};
		const properties = (type: Function) =>
			Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, type.prototype) as string[];
		const describe = (type: Function, key: string) =>
			Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, type.prototype, key);

		const Partial = PartialType(ItemDTO);
		expect(properties(UpdateItemDTO)).toEqual(properties(Partial));
		for (const key of ['name', 'isEnabled', 'priority', 'startsAt']) {
			expect(describe(UpdateItemDTO, key)).toEqual(describe(Partial, key));
		}
	});
});

describe('core update bodies carry only what the client sent', () => {
	const id = '7a1f3f53-63d2-4b8e-9d44-5f3c5c0f9b11';

	/** The same pipe call, with the refusal's reasons in the failure message instead of "Bad Request Exception". */
	async function accepted(pipe: ValidationPipe, metatype: ArgumentMetadata['metatype'], body: Record<string, unknown>) {
		try {
			return await through(pipe, metatype, body);
		} catch (error) {
			throw new Error(JSON.stringify((error as BadRequestException).getResponse?.() ?? error));
		}
	}

	/**
	 * The team body requires `organizationId`, whose validator asks the request context whether the caller belongs to
	 * the organization - there is none in a unit spec - so the team is checked at the step the pipe takes before it
	 * validates: `plainToInstance`, which is where a default would enter.
	 */
	it('UpdateOrganizationTeamDTO (PUT /organization-team/:id)', () => {
		const body = { id, color: '#ff0000' };

		expect({ ...new UpdateOrganizationTeamDTO() }).toEqual({});
		expect({ ...plainToInstance(UpdateOrganizationTeamDTO, body) }).toEqual(body);
	});

	it.each([
		['UpdateOrganizationProjectModuleDTO (PUT /organization-project-modules/:id)', UpdateOrganizationProjectModuleDTO, { description: 'x' }],
		['UpdateOrganizationProjectDTO (PUT /organization-projects/:id)', UpdateOrganizationProjectDTO, { name: 'Renamed' }],
		['UpdateOrganizationSprintDTO (PUT /organization-sprint/:id)', UpdateOrganizationSprintDTO, { goal: 'ship' }]
	])('%s', async (_name, metatype, body) => {
		expect({ ...(await accepted(transformPipe, metatype, body)) }).toEqual(body);
		expect(await accepted(whitelistPipe, metatype, body)).toEqual(body);
	});

	it('UpdateTimesheetStatusDTO (PUT /timesheet/status) still requires its ids, without a default to stand in', async () => {
		expect({ ...new UpdateTimesheetStatusDTO() }).toEqual({});
		await expect(through(transformPipe, UpdateTimesheetStatusDTO, { status: 'APPROVED' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});
