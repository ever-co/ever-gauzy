// Code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

/**
 * Generic pagination interface
 */
export interface IPagination<T> {
  /**
   * Items included in the current listing
   */
  readonly items: T[];

  /**
   * Total number of available items
   */
  readonly total: number;
}
