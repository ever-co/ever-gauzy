// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * environment variables that goes into process.env
 */
export interface Env {
  LOG_LEVEL?: LogLevel;
  [key: string]: string;
}

/**
 * Server Environment
 */
export interface IEnvironment {
  production: boolean;
  envName: string;

  env?: Env;

  USER_PASSWORD_BCRYPT_SALT_ROUNDS?: number;
  JWT_SECRET?: string,

  database: TypeOrmModuleOptions;
}
