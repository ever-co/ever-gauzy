import { UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag, Public } from '@gauzy/common';
import { ID as Id, IInvoice } from '@gauzy/contracts';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { FeatureFlagGuard } from '../../shared/guards';
import { FindPublicInvoiceQuery } from './queries';

/**
 * The shared invoice over GraphQL: the document a share link opens, read by the link's own two members.
 *
 * REST and GraphQL are two views of the same operation, so this resolver owns no business logic of its
 * own: the one field below dispatches the same `FindPublicInvoiceQuery` that `GET /public/invoice/:id/:token`
 * dispatches, which verifies the token as an invoice-share token for exactly this invoice and matches the
 * row by the identifier, the stored token and the tenant the token names. A wrong token, a token of another
 * kind, a token for another invoice and a link that has been regenerated are one refusal on purpose.
 *
 * **The field is `@Public()`, as its route is, and that follows the `inviteByToken` precedent exactly**:
 * the route carries the platform's public marker because the person opening a share link has no account,
 * so the field carries it too and states no guard and no permission of its own. The class carries only the
 * capability gate, as the invite resolver's does — with the limitation that resolver's and the corpus
 * resolver's comments record: the gate resolves from the caller's tenant scope, so a caller without one is
 * served only where the capability resolves for an unscoped request. The field is never wider than the
 * route; it may be narrower, and that is stated rather than worked around by dropping the gate.
 *
 * **The answer is the invoice row and nothing it hangs off.** The `Invoice` type declares no relation, so
 * the read loads none (the route's `relations` allow-list has no spelling here), and the operator's
 * internal note is withheld: it is a note to the issuing organization, never a member of a document shown
 * to whoever holds the link.
 */
@Resolver('Invoice')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PublicInvoiceResolver {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * The invoice a share link opens.
	 *
	 * A miss is a refusal rather than a null, as the route answers it: "no such invoice" and "the token was
	 * wrong" are one answer, because telling them apart would confirm which links are live.
	 */
	@Query('invoiceByToken')
	@Public()
	async invoiceByToken(
		@Args('id', { type: () => ID }) id: Id,
		@Args('token', { type: () => String }) token: string
	): Promise<IInvoice> {
		const invoice: IInvoice = await this.queryBus.execute(new FindPublicInvoiceQuery({ id, token }, []));

		return { ...invoice, internalNote: undefined };
	}
}
