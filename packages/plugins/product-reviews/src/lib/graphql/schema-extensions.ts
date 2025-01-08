import { gql } from 'graphql-tag';

export const schemaExtensions = gql`
    type ProductReview {
        id: ID!
        body: String
        rating: Float!
    }

    type Query {
        getProductReviews: [ProductReview!]!
    }

    type Mutation {
        addProductReview(body: String, rating: Float!): ProductReview
    }
`;
