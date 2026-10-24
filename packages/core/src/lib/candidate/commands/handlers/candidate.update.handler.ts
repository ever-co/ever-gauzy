import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ICandidate, ICandidateUpdateInput } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateUpdateCommand } from '../candidate.update.command';
import { ownContactPatch } from '../../../contact/profile-contact.helper';
import { RequestContext } from '../../../core/context';

@CommandHandler(CandidateUpdateCommand)
export class CandidateUpdateHandler
	implements ICommandHandler<CandidateUpdateCommand> {

	constructor(
		private readonly candidateService: CandidateService
	) {}

	public async execute(command: CandidateUpdateCommand): Promise<ICandidate> {
		const { input } = command;
		const { id } = input;

		// A candidate edit never writes the linked User. `Candidate.user` cascades, so a nested
		// `user: { id, hash, email }` overwrote ANY user's credentials (another tenant's, or a
		// super admin of the same tenant), and `userId` re-linked the candidate to another account
		// (GHSA-jh6m-9fxr-rx3c). The UI edits the candidate's user through PUT /user/:id instead.
		const candidate: ICandidateUpdateInput = { ...input };
		delete (candidate as any).user;
		delete (candidate as any).userId;

		// Nor another contact: `Candidate.contact` cascades by id too, so a nested id overwrote any contact of the
		// tenant (an organization's, a client's, an employee's), and `contactId` re-linked the candidate to it. Only
		// the candidate's stored contact is kept as an id, under the candidate's tenant and organization.
		delete (candidate as any).contactId;
		if (candidate.contact) {
			// The contact and the organization are read as relations: under MikroORM their id columns are not filled.
			// The candidate is read inside the caller's tenant, which is the tenant its contact is stamped with.
			const stored = await this.candidateService.findOneByIdString(id, {
				relations: { contact: true, organization: true }
			});
			candidate.contact = ownContactPatch(
				{ ...stored, tenantId: stored.tenantId ?? RequestContext.currentTenantId() },
				candidate.contact
			);
		}

		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.candidateService.create({ ...candidate, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
