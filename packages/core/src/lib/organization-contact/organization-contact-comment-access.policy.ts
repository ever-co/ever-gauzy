import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { CommentParentAccessPolicy, ICommentParent, ICommentParentAccessPolicy } from '../comment/parent-access';
import { OrganizationContactService } from './organization-contact.service';

/**
 * Who may read and write a contact's notes: the comments whose `entity` is `OrganizationContact`.
 *
 * Reading them takes `ORG_CONTACT_VIEW` and writing them `ORG_CONTACT_EDIT`, the permissions that guard the
 * contact's own list and edit. Either way the contact must be one the caller reaches through the contact read
 * itself — the caller's tenant, inside their organization boundary — so a contact of another organization
 * answers as a missing one.
 */
@CommentParentAccessPolicy()
@Injectable()
export class OrganizationContactCommentAccessPolicy implements ICommentParentAccessPolicy {
	readonly entity = BaseEntityEnum.OrganizationContact;
	readonly readPermissions = [PermissionsEnum.ORG_CONTACT_VIEW] as const;
	readonly writePermissions = [PermissionsEnum.ORG_CONTACT_EDIT] as const;

	constructor(private readonly organizationContactService: OrganizationContactService) {}

	async findAccessibleParent(entityId: ID): Promise<ICommentParent | null> {
		try {
			const contact = await this.organizationContactService.findOneByIdString(entityId);
			return contact ? { id: contact.id, organizationId: contact.organizationId } : null;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}
}
