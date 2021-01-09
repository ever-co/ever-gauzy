import { gql } from 'apollo-server-core';

export const schemaExtensions = gql`
  type ProductReview {
    id: ID!
    body: String
    rating: Float!
  }
`;
