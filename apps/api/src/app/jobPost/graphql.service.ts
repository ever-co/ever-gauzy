import { ApolloServer, gql } from 'apollo-server-micro';

const typeDefs = gql`
	type Query {
		users: [User!]!
	}
	type User {
		id: Int!
		firstName: String
	}
`;

const resolvers = {
	Query: {
		users(parent, args, context) {
			return [{ firstName: 'Nextjs' }];
		}
	}
};

export const config = {
	api: {
		bodyParser: false
	}
};

const apolloServer = new ApolloServer({ typeDefs, resolvers });

export default apolloServer.createHandler({ path: '/api/graphql' });
