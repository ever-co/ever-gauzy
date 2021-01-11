import { PluginConfig } from '@gauzy/common';
import { ReviewsPlugin } from '@gauzy/plugins';

export const config: PluginConfig = {
  apiConfig: {
    port: 3001,
    middleware: [],
    graphqlConfig: {
      path: 'graphql',
      playground: true,
      debug: true,
      apolloServerPlugins: [],
    },
  },
  dbConnectionConfig: {
    type: 'mysql',
    port: 3306,
    synchronize: true,
    logging: true,
    database: 'plugin-dev',
    username: 'root',
    password: 'root',
  },
  plugins: [ReviewsPlugin],
};
