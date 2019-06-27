import { IEnvironment } from './ienvironment';

export const environment : IEnvironment = {
  production: true,  
  envName: 'prod',
  env: {
    LOG_LEVEL: 'debug'
  },
  USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: 'secretKey',
  database: {
    type: 'postgres',
    host: 'db',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: 'root',
    keepConnectionAlive: true,
    logging: true,
    synchronize: true,
    uuidExtension: 'pgcrypto',
  },
  defaultAdmins: [{
    email: 'admin@ever.co',
    password: "admin"
  }]
};
