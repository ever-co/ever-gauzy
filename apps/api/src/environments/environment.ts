// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { IEnvironment } from './ienvironment';

export const environment: IEnvironment = {
  production: false,
  envName: 'dev',

  env: {
    LOG_LEVEL: 'debug'
  },

  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: 'root',
    keepConnectionAlive: true,
    logging: true,
    synchronize: true,
    uuidExtension: 'pgcrypto',
  }
};
