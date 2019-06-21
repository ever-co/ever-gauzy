// Code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export enum OrderType {
  DESC = 'DESC',
  ASC = 'ASC',
}

/**
 * Describes generic pagination params
 */
export abstract class PaginationParams<T> {
  /**
   * Pagination limit
   */
  @ApiModelPropertyOptional({ type: Number, minimum: 0, maximum: 50 })
  @IsOptional()
  @Min(0)
  @Max(50)
  @Transform((val: string) => parseInt(val, 10))
  readonly take = 10;

  /**
   * Pagination offset
   */
  @ApiModelPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @Min(0)
  @Transform((val: string) => parseInt(val, 10))
  readonly skip = 0;

  /**
   * OrderBy
   */
  @ApiModelPropertyOptional()
  @IsOptional()
  abstract readonly order?: { [P in keyof T]?: OrderType };
}
