import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { FindOptionsRelations } from "typeorm";

export class OrganizationFindQueryDTO<T = any>  {

	/**
     * Indicates what relations of entity should be loaded (simplified left join form).
     */
	@ApiPropertyOptional({ type: Array, isArray: true })
	@IsOptional()
	@IsArray()
	readonly relations?: FindOptionsRelations<T>;
}