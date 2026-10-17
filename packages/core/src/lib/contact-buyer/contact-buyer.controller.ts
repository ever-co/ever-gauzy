import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IContactBuyer, IContactBuyerFindInput, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactBuyerService } from './contact-buyer.service';
import { ContactBuyerQueryDTO, CreateContactBuyerDTO } from './dto';

/**
 * Company-account membership over REST.
 *
 * **A buyer is a person's membership of a company account**, with the role that says what they may do
 * and the ceilings that narrow it. Every rule the resource has is the service's — the account must be a
 * company, it must be live, a party is never its own buyer, a buyer belongs to at most one live account,
 * and the limits narrow and never widen — and this class adds exactly three things to it: the
 * permissions each route carries, the validation of the body the create accepts, and the list envelope.
 *
 * **Neither side of the pivot is mutable, so there is no update route.** A membership that could be
 * re-pointed at another buyer or another account would be a way to move purchasing authority without a
 * trace; the supported path is to remove the membership and attach a new one, which is the pair of
 * routes below. The update method the service carries is therefore reachable from the flows that own a
 * term change and not from here, and that is reported rather than papered over with a route whose
 * mutation the specification's row does not name.
 *
 * **The set-replacement route of the endpoint table is not delivered.** §7.7 writes the membership write
 * as `PUT /organization-contacts/:id/buyers` with `items[]` of `(contactId, isPrimary, role)`, and
 * neither half of that can be honoured: the delivered service offers `addBuyer` and `removeBuyer` for
 * one pair and no replace-set operation, so a route would have to compose the set out of reads and
 * writes with no transaction behind it; and `isPrimary` is not a column of the pivot — what the pivot
 * carries instead is a **role**, one membership per pair, and a buyer who belongs to one live account at
 * a time. Writing an `isPrimary` flag into `metadata` would be storing a fact nothing reads.
 *
 * **Three routes, declared explicitly, and the class does not extend `CrudController`.** The base class
 * maps a collection count, a pagination route, a detail read, an update and a recovery pair; the two
 * writes among them are capabilities the specification's row does not name as root fields, so a REST
 * surface that offered them would be wider than the GraphQL one — and the inherited update would accept
 * any body at all, because the base parameter reflects as `Object` and a validation pipe skips a
 * parameter it cannot name a class for.
 *
 * **The contact-token half of the authorisation column cannot be implemented.** §7.7 writes
 * `ORG_CONTACT_VIEW / Contact token` and `ORG_CONTACT_EDIT / Contact token` for the contact rows, and
 * there is no contact subject in `RequestContext` and no decorator that establishes one, so every route
 * here is guarded on the staff permission the same row names.
 */
@ApiTags('ContactBuyer')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
@Controller('/contact-buyers')
export class ContactBuyerController {
	constructor(private readonly contactBuyerService: ContactBuyerService) {}

	/**
	 * Lists the company-account memberships of the caller's organization, newest first.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of memberships.
	 */
	@ApiOperation({ summary: 'List company-account memberships' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Buyer memberships retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: ContactBuyerQueryDTO): Promise<IPagination<IContactBuyer>> {
		const rows = await this.contactBuyerService.listBuyers(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		return paginateRows(rows, take, skip);
	}

	/**
	 * Attaches a buyer to a company account.
	 *
	 * @param entity The account, the buyer and the terms as the caller states them.
	 * @returns The stored membership.
	 */
	@ApiOperation({ summary: 'Attach a buyer to a company account' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Buyer attached' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'COMPANY_ACCOUNT_REQUIRED, CONTACT_BLOCKED, CONTACT_BUYER_SELF, CONTACT_BUYER_EXISTS, CONTACT_BUYER_COMPANY_EXISTS, CONTACT_BUYER_TERMS_INVALID'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateContactBuyerDTO): Promise<IContactBuyer> {
		return this.contactBuyerService.addBuyer(entity);
	}

	/**
	 * Removes a membership, softly, which is the only removal path there is.
	 *
	 * The row is kept: an order placed by this buyer must remain attributable to the membership that
	 * authorised it, and a hard delete would leave the order's own history pointing at nothing.
	 *
	 * @param id The membership to remove.
	 * @returns The stored membership, soft-deleted.
	 */
	@ApiOperation({ summary: 'Remove a company-account membership' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Membership removed' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_BUYER_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IContactBuyer> {
		return this.contactBuyerService.removeBuyer(id);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * The table's spelling of each side of the pivot wins over the column's own name when both are
	 * stated, because the table is the document a client is written against; the flat spelling wins over
	 * the bracketed one for the same reason. A member that was not stated is left out rather than
	 * written as `undefined`, because a repository handed an explicit `undefined` asks for a row whose
	 * column *is* null — a different question from "do not narrow on this column".
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: ContactBuyerQueryDTO): IContactBuyerFindInput {
		const buyerCustomerId =
			query?.contactId ?? query?.filter?.contactId ?? query?.buyerCustomerId ?? query?.filter?.buyerCustomerId;
		const companyCustomerId =
			query?.organizationContactId ??
			query?.filter?.organizationContactId ??
			query?.companyCustomerId ??
			query?.filter?.companyCustomerId;
		const role = query?.role ?? query?.filter?.role;
		const stated: IContactBuyerFindInput = {};

		if (buyerCustomerId !== undefined && buyerCustomerId !== null) {
			stated.buyerCustomerId = buyerCustomerId;
		}

		if (companyCustomerId !== undefined && companyCustomerId !== null) {
			stated.companyCustomerId = companyCustomerId;
		}

		if (role !== undefined && role !== null) {
			stated.role = role;
		}

		return stated;
	}
}
