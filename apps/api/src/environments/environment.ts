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

  USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: 'secretKey',

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
  },

  dummyOrganizationsNames: [
    'Ever',
    'Ever-2',
    'Ever-co'
  ],

  defaultAdmins: [{
    email: 'admin@ever.co',
    password: "admin"
  }],

  defaultEmployees: [
    {
      email: 'alish@ever.co',
      password: '123456',
      firstName: 'Alish',
      lastName: 'Meklyov',
    },
    {
      email: 'blagovest@ever.co',
      password: '123456',
      firstName: 'Blagovest',
      lastName: 'Gerov',
    },
    {
      email: 'elvis@ever.co',
      password: '123456',
      firstName: 'Elvis',
      lastName: 'Arabadjiiski',
    },
    {
      email: 'emil@ever.co',
      password: '123456',
      firstName: 'Emil',
      lastName: 'Momchilov',
    },
    {
      email: 'boyan@ever.co',
      password: '123456',
      firstName: 'Boyan',
      lastName: 'Stanchev',
    },
    {
      email: 'hristo@ever.co',
      password: '123456',
      firstName: 'Hristo',
      lastName: 'Hristov',
    }
  ]
};
