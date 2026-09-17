# The error contract.
#
# This file declares no types on purpose. A GraphQL error is not part of the schema: it travels in
# the `extensions` object of an entry in the response's `errors` array, so the contract is documented
# here — next to the schema rather than only in prose — and asserted by the error filter.
#
# The response status of an operation that executed is 200, including when it produced errors. The
# status the caller should act on travels in `extensions.status`, exactly as the REST route for the
# same operation would have answered.
#
#   "errors": [
#     {
#       "message": "The order does not exist.",
#       "path": ["order"],
#       "extensions": {
#         "code": "ORDER_NOT_FOUND",
#         "status": 404,
#         "details": { "resource": "order", "id": "…" },
#         "traceId": "0af7651916cd43dd8448eb211c80319c"
#       }
#     }
#   ]
#
# `code`     String, required. The stable platform error code, identical to the string the REST
#            surface returns for the same condition. A client branches on this and never on the
#            message text.
# `status`   Int, required. The status the REST route would have returned.
# `details`  JSON, optional. The same structured detail REST emits: which field was refused and
#            what was allowed, the expected and actual version of a lost update, the requested and
#            available quantity of a stock conflict. Absent when there is nothing structured to say.
# `traceId`  String, present when tracing is on. The join key between a caller's report and the
#            server's logs, and the same value the REST surface puts in its own error body.
#
# Nothing else is added: no stack trace, no ORM payload, no SQL. A resolver error that is not a
# refusal the caller can act on becomes an internal error with the driver's text removed, so a
# failure never leaks the shape of the database to a client.
#
# A business outcome the caller can correct — a coupon that has expired, a quantity that is not
# available — is not an error at all. It is reported in the mutation payload's `userErrors`, and the
# operation succeeds.
