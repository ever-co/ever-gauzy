/**
 * `PUT /proposals/:id` hands the service what the client sent and nothing else (review R3-04/R3-05, measured by
 * `tools/scripts/update-dto-initializer-check.mjs`).
 *
 * `ProposalDTO.status` defaults to `SENT`, and the mapped types' constructor copies that default into every
 * `UpdateProposalDTO` the route's `ValidationPipe({ transform: true })` builds - so editing a proposal's content
 * moved an `ACCEPTED` proposal back to `SENT`.
 *
 * `@gauzy/core` is doubled (its barrel boots the application graph); `WithoutInitializers` comes from
 * `@gauzy/common`, real.
 */
jest.mock('@gauzy/core', () => ({
	TenantOrganizationBaseDTO: class {},
	RelationalTagDTO: class {}
}));

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateProposalDTO } from './update-proposal.dto';

describe('UpdateProposalDTO', () => {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });

	it('carries only the members the client sent', async () => {
		const body = { proposalContent: 'Revised scope' };

		expect({ ...(await pipe.transform({ ...body }, { type: 'body', metatype: UpdateProposalDTO })) }).toEqual(body);
	});

	it('still validates the status it accepts', async () => {
		await expect(
			pipe.transform({ status: 'NOT_A_STATUS' }, { type: 'body', metatype: UpdateProposalDTO })
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
