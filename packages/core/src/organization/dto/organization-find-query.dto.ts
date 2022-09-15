import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { FindOptionsRelations } from "typeorm";

export class OrganizationFindQueryDTO<T = any>  {

	/**
     * Indicates what relations of entity should be loaded (simplified left join form).
     */
	@ApiPropertyOptional({ type: Object, readOnly: true })
	@IsOptional()
	readonly relations?: FindOptionsRelations<T>;
}