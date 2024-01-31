import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Not } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { isEmpty } from "@gauzy/common";
import { OrganizationTeam } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";
import { TypeOrmOrganizationTeamRepository } from "../../../organization-team/repository/type-orm-organization-team.repository";
import { MikroOrmOrganizationTeamRepository } from "../../../organization-team/repository/mikro-orm-organization-team.repository";

/**
 *
 */
@ValidatorConstraint({ name: "IsTeamAlreadyExist", async: true })
@Injectable()
export class TeamAlreadyExistConstraint implements ValidatorConstraintInterface {

	constructor(
		@InjectRepository(OrganizationTeam)
		readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,

		readonly mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository
	) { }

	/**
	 * Method to be called to perform custom validation over given value.
	 */
	async validate(name: any, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(name)) {
			return true; // Empty value is considered valid
		}

		const payload: object = args.object;
		try {
			if (payload['organizationId'] || payload['organization']['id']) {
				const organizationId = payload['organizationId'] || payload['organization']['id'];
				const tenantId = RequestContext.currentTenantId();

				const queryConditions: Record<string, any> = {
					name,
					organizationId,
					tenantId
				};

				if (payload['id']) {
					queryConditions.id = Not(payload['id']);
				}

				const existingTeam = await this.typeOrmOrganizationTeamRepository.findOneByOrFail(queryConditions);
				return !existingTeam;
			}
			return true;
		} catch (error) {
			return true;
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `Team "${value}" already exists.`;
	}
}
