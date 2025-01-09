import { gql } from 'graphql-tag';

export const schemaExtensions = gql`
    type ProductReview {
        id: ID!
        body: String
        rating: Float!
    }
`;
