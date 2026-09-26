<!--
Superseded. This file began as the kernel schema document and was split into the documents that are
now loaded: common.type.gql (root operation types, scalars, the event envelope, the operation
types), ilter.type.gql (the shared filter inputs), pagination.type.gql (the page input) and
../role/schema/role.type.gql with ../role/schema/role.api.gql (the role domain). It is kept as a
readable record of the whole kernel surface in one place, and it is deliberately NOT a .gql file:
two documents declaring one type cannot both survive uildSchema, and ProductReview belongs to
the reviews plugin rather than to the kernel. The loaded documents are the source of truth.
-->
scalar DateTime

scalar Decimal

scalar JSON

type Query {
  roles: Role!
  role(id: ID!): Role
}

type Mutation {
  createRole(input: CreateRoleInput!): Role!
  updateRole(input: UpdateRoleInput!): Role!
}

type Subscription {
  """
  A stream of the platform's events, selected by name. One event is delivered per message, so a
  payload never merges unrelated facts. A subscription is a notification and never a system of
  record: an event produced while a client is disconnected is not replayed, and a client that must
  not miss one registers a webhook.
  """
  events(
    """
    The event names to receive, exactly as the platform names them (`order.placed`) or as a
    one-segment prefix pattern (`order.*`). At least one name is required, and a selection that
    matches no known event is refused at subscribe time so a typo is visible immediately.
    """
    names: [String!]!

    """
    Narrows the stream to one aggregate. It can only narrow what the credential may read.
    """
    aggregateId: ID

    """Narrows the stream to one channel of the credential's own scope."""
    channelId: ID
  ): EventEnvelope
}

"""One event of the platform catalogue, as a subscriber receives it."""
type EventEnvelope {
  """
  The event identity: stable, and the idempotency key a consumer applies its effects under.
  """
  eventId: ID!

  """The event name, `<aggregate>.<action>`."""
  eventName: String!

  """When the fact happened, as opposed to when it was dispatched."""
  occurredAt: DateTime!

  """The aggregate that changed."""
  aggregate: EventAggregate!

  """
  Monotonic within the tenant. It correlates an event with the delivery ledger; it is not a cursor,
  because a subscription does not resume.
  """
  sequence: Int

  """
  The event body: the catalogued payload of that event, never an entity dump.
  """
  data: JSON!
}

"""The aggregate an event belongs to."""
type EventAggregate {
  """The aggregate type in PascalCase, for example `Order`."""
  type: String!

  """The aggregate instance."""
  id: ID!
}

"""
The boundary of a page.

One shared type, so a client learns the shape once and a cursor means the same thing on every
connection. `startCursor` and `endCursor` are opaque: they are produced and consumed by the same
codec the REST surface uses, so a cursor obtained over one surface resumes on the other.
"""
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

"""
An expected, caller-correctable outcome of a mutation.

This is a payload member, not an error transport: a business rejection is reported here with the
operation succeeding, and only a request the caller could not have made correctly becomes a GraphQL
error. `path` names the input member the outcome belongs to, as a field path.
"""
type UserError {
  """
  The stable platform error code, the same string the REST surface returns for the condition.
  """
  code: String!

  """A message written for the caller."""
  message: String!

  """The input members this outcome belongs to, as a field path."""
  path: [String!]

  """Structured detail: which values were refused and why."""
  details: JSON
}

"""How far a durable multi-step operation has come."""
enum OperationStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  COMPENSATING
  COMPENSATED
  CANCELED
}

"""How far one step of a durable operation has come."""
enum OperationStepStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
  COMPENSATING
  COMPENSATED
  COMPENSATION_FAILED
}

"""
A durable multi-step operation: a write that spans more than one step, whose progress survives a
restart and whose partial effects are undone when a later step fails.
"""
type Operation {
  id: ID!

  """
  The operation type, for example `CHECKOUT_COMPLETE`. Declared as a string rather than an enum
  because an operation type is registered by the package that owns the workflow, and a closed enum
  would make a new workflow a schema change.
  """
  type: String!
  status: OperationStatus!

  """The aggregate type the operation acts on."""
  aggregateType: String!

  """The aggregate instance the operation acts on."""
  aggregateId: ID!

  """Completion in the range 0 to 1."""
  progress: Float!
  steps: [OperationStep!]!
  startedAt: DateTime
  finishedAt: DateTime

  """When the operation is abandoned if it has not finished."""
  deadlineAt: DateTime

  """Why it failed, when it did."""
  failureReason: String
}

"""One step of a durable operation."""
type OperationStep {
  id: ID!

  """The step name from the operation definition."""
  name: String!
  status: OperationStepStatus!

  """How many times this step has been attempted."""
  attempt: Int!
  startedAt: DateTime
  finishedAt: DateTime

  """
  The state of this step's compensating action, when the operation had to undo its work.
  """
  compensationStatus: OperationStepStatus
}

"""Equality and set membership on an identifier."""
input IDFilter {
  """The value is equal to this."""
  eq: ID

  """
  The value is not equal to this. Rows where the column is absent are excluded.
  """
  ne: ID

  """The value is one of these."""
  in: [ID!]

  """
  The value is none of these. Rows where the column is absent are excluded.
  """
  nin: [ID!]

  """
  Whether the column is absent. `true` selects absent values, `false` selects present ones.
  """
  isNull: Boolean
}

"""Comparison and pattern matching on text."""
input StringFilter {
  eq: String
  ne: String
  in: [String!]
  nin: [String!]

  """A case-sensitive pattern. `%` and `_` are wildcards."""
  like: String

  """A case-insensitive pattern. `%` and `_` are wildcards."""
  ilike: String
  isNull: Boolean

  """A value contained in a document or array column."""
  contains: [String!]
}

"""Comparison on a whole number."""
input NumberFilter {
  eq: Int
  ne: Int
  in: [Int!]
  nin: [Int!]
  gt: Int
  gte: Int
  lt: Int
  lte: Int

  """Exactly two bounds, inclusive at both ends, lower first."""
  between: [Int!]
  isNull: Boolean
}

"""
Comparison on an exact decimal, such as a money amount or a rate.

Values are decimal strings rather than floating-point numbers, for the same reason the output is:
`100.10` has no exact binary representation, and a filter that rounds is a filter that returns the
wrong rows.
"""
input DecimalFilter {
  eq: Decimal
  ne: Decimal
  in: [Decimal!]
  nin: [Decimal!]
  gt: Decimal
  gte: Decimal
  lt: Decimal
  lte: Decimal

  """Exactly two bounds, inclusive at both ends, lower first."""
  between: [Decimal!]
  isNull: Boolean
}

"""Comparison on a flag."""
input BooleanFilter {
  eq: Boolean
  ne: Boolean
  isNull: Boolean
}

"""Comparison on an instant."""
input DateTimeFilter {
  eq: DateTime
  ne: DateTime
  gt: DateTime
  gte: DateTime
  lt: DateTime
  lte: DateTime

  """Exactly two bounds, inclusive at both ends, earlier first."""
  between: [DateTime!]
  isNull: Boolean
}

"""Comparison on a document column."""
input JSONFilter {
  eq: JSON
  ne: JSON
  contains: [String!]
  isNull: Boolean
}

"""
A tenant filter, with exactly one member.

The tenant a read runs under comes from the credential, never from a filter, so there is nothing for
a caller to choose here: the single member exists so that a resource whose rows are shared across
organizations inside one tenant can say so in its generated input, and its value is checked against
the caller's own tenant before it is used.
"""
input TenantFilter {
  """
  The tenant the caller is acting in. It must be the caller's own tenant.
  """
  id: ID!
}

"""
Cursor pagination. `first`/`after` walk forwards, `last`/`before` walk backwards, and a request that
states both directions is refused.
"""
input PageInput {
  """The page size, walking forwards from `after`."""
  first: Int

  """Resume after this cursor. Exclusive."""
  after: String

  """The page size, walking backwards from `before`."""
  last: Int

  """Resume before this cursor. Exclusive."""
  before: String
}

"""The direction of one sort key."""
enum SortDirection {
  ASC
  DESC
}

input CreateRoleInput {
  name: String!
  tenantId: String!
}

input UpdateRoleInput {
  id: ID!
  name: String
  tenantId: String!
}

type Role {
  id: ID!
  name: String!
  tenantId: String!
}

type ProductReview {
  id: ID!
  body: String
  rating: Float!
}