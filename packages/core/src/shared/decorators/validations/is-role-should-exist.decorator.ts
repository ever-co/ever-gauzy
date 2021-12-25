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
		return !!(
			await getConnection().getRepository(Role).findOne({
				where: (query: SelectQueryBuilder<Role>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (typeof(role) === 'string') {
								qb.andWhere(`"${query.alias}"."id" = :roleId`, {
									roleId: role
								});
							} else if (role instanceof Role) {
								qb.andWhere(`"${query.alias}"."id" = :roleId`, {
									roleId: role.id
								});
							}
							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						})
					);
				}
			})
		);
	}
}