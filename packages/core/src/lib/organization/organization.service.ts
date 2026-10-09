import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { IPartialEntity } from './../core/crud/icrud.service';
import { sanitizeRichHtml } from './../core/html-sanitizer';
import { Organization } from './organization.entity';
import { TypeOrmOrganizationRepository } from './repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from './repository/mikro-orm-organization.repository';

@Injectable()
export class OrganizationService extends TenantAwareCrudService<Organization> {
	constructor(
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {
		super(typeOrmOrganizationRepository, mikroOrmOrganizationRepository);
	}

	/**
	 * Creates (or, via the organization update command handler, upserts) an organization,
	 * sanitizing the rich-text `overview` HTML through the shared server-side allowlist before
	 * persisting. `Organization.overview` is rendered with raw `[innerHTML]` on the PUBLIC
	 * organization page, so every write path must be sanitized (see `sanitizeRichHtml`).
	 *
	 * @param entity - The organization data to persist.
	 * @returns The persisted organization.
	 */
	public async create(entity: IPartialEntity<Organization>): Promise<Organization> {
		const input = entity as { overview?: string };
		if (typeof input.overview === 'string') {
			input.overview = sanitizeRichHtml(input.overview);
		}
		return await super.create(entity);
	}
}
