/**
 * The TypeScript shapes of the payment schema.
 *
 * The SDL is the contract and this folder is the TypeScript side of it: the connection and payload
 * conventions every resolver shares, and the per-connection filters, orderings and inputs the
 * resolvers read their arguments into. Keeping them here rather than inline in a signature means a
 * resolver says which mutation it serves and nothing more.
 */
export * from './connection';
export * from './payment.types';
