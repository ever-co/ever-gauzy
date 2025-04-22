import { gql } from '@apollo/client';

export const schemaExtensions = gql`
	type ProductReview {
		id: ID!
		body: String
		rating: Float!
	}
`;
