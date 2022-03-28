import { Brackets, getConnection, SelectQueryBuilder, WhereExpressionBuilder } from "typeorm";
import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IRole } from "@gauzy/contracts";
import { Role } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

/**
 * Role should existed validation constraint
 * 
 * @param validationOptions 
 * @returns 
 */
export const IsRoleShouldExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsRoleShouldExistConstraint,
		});
    };
}

@ValidatorConstraint({ name: "IsRoleShouldExist", async: true })
export class IsRoleShouldExistConstraint implements ValidatorConstraintInterface {
	async validate(role: string | IRole, args: ValidationArguments) {
		if (!role) {
			return false;
		}
		const tenantId = RequestContext.currentTenantId();
		let roleId: string;
		if (typeof(role) === 'string') {
			roleId = role;
		} else if (typeof role == 'object') {
			roleId = role.id
		}

		if (!roleId) {
			return false;
		}
		const existed = (
			await getConnection().getRepository(Role).findOne({
				where: (query: SelectQueryBuilder<Role>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."id" = :roleId`, {
								roleId: roleId
							});
							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						})
					);
				}
			})
		);
		return !!existed;
	}
}