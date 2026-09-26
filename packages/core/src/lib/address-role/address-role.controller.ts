import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseEnumPipe,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AddressRole } from './address-role.entity';
import { AddressRoleService } from './address-role.service';
import { AddressRoleEnum } from './address-role.enums';
import { CreateAddressRoleDTO, SetAddressRoleDefaultDTO, UpdateAddressRoleDTO } from './dto';

/**
 * What a row of the address book is *for*, over REST.
 *
 * The path is the plural concept — `/address-roles` — and the guard is the address book's own
 * permission rather than a pair of its own: the placement doctrine records that address roles are "a
 * dimension of the core address book rather than a column per role", and a dimension does not get a
 * permission of its own any more than a column does. Whoever may read a party's addresses may read
 * what they are for; whoever may edit them may change it.
 *
 * The three role values a *carrier label* prints, a purchase order prints and a seller is paid at
 * arrive through the flows that own them — fulfilment, purchasing, the marketplace seller — and are
 * written by those flows through `AddressRoleService`. What this controller serves is the address
 * book itself: reading an address's roles, giving it one, and resolving which of a party's addresses
 * is the default for a role.
 */
@ApiTags('AddressRole')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
@Controller('/address-roles')
export class AddressRoleController extends CrudController<AddressRole> {
	constructor(private readonly addressRoleService: AddressRoleService) {
		super(addressRoleService);
	}

	/**
	 * Lists role rows of the caller's organization, optionally of one address or one role.
	 */
	@ApiOperation({ summary: 'List what the addresses of this organization are used for.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found address roles', type: AddressRole })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<AddressRole>): Promise<IPagination<AddressRole>> {
		return this.addressRoleService.findAll(params);
	}

	/**
	 * The roles one address plays.
	 */
	@ApiOperation({ summary: 'Read the roles one address plays.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The role rows of the address' })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get('address/:addressId')
	async findByAddress(@Param('addressId', UUIDValidationPipe) addressId: ID): Promise<AddressRole[]> {
		return this.addressRoleService.listForAddress(addressId);
	}

	/**
	 * The default address for a role among the addresses of one owner, or `null` when none claims it.
	 */
	@ApiOperation({ summary: 'Resolve the default address for a role among the addresses of one owner.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The default address id, or null' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_DEFAULT_MISMATCH' })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@HttpCode(HttpStatus.OK)
	@Post('default/:role')
	@UseValidationPipe()
	async defaultFor(
		@Param('role', new ParseEnumPipe(AddressRoleEnum)) role: AddressRoleEnum,
		@Body() entity: SetAddressRoleDefaultDTO
	): Promise<{ addressId: ID | null }> {
		return { addressId: await this.addressRoleService.defaultFor(role, entity.ownerAddressIds) };
	}

	/**
	 * Gives an address a role.
	 */
	@ApiOperation({ summary: 'Give an address a role.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The role row', type: AddressRole })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateAddressRoleDTO): Promise<AddressRole> {
		return this.addressRoleService.assign(entity.addressId, entity.role, {
			isDefault: entity.isDefault,
			metadata: entity.metadata as Record<string, unknown>
		});
	}

	/**
	 * Makes one address the default for a role, clearing the flag on the siblings the caller names.
	 */
	@ApiOperation({ summary: 'Make an address the default for one of its roles.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The role row' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':addressId/:role/default')
	@UseValidationPipe()
	async setDefault(
		@Param('addressId', UUIDValidationPipe) addressId: ID,
		@Param('role', new ParseEnumPipe(AddressRoleEnum)) role: AddressRoleEnum,
		@Body() entity: SetAddressRoleDefaultDTO
	): Promise<AddressRole> {
		return this.addressRoleService.setDefault(addressId, role, entity.ownerAddressIds);
	}

	/**
	 * Changes a role row.
	 */
	@ApiOperation({ summary: 'Change a role given to an address.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The role row' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateAddressRoleDTO
	): Promise<AddressRole> {
		const row = await this.addressRoleService.findOneByIdString(id);

		if (entity.isDefault !== undefined) {
			row.isDefault = entity.isDefault;
		}

		if (entity.metadata !== undefined) {
			row.metadata = entity.metadata;
		}

		return this.addressRoleService.save(row);
	}

	/**
	 * Removes a role from an address.
	 */
	@ApiOperation({ summary: 'Remove a role from an address.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The role was removed' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string) {
		await this.addressRoleService.findOneByIdString(id);

		return this.addressRoleService.softRemove(id);
	}
}
