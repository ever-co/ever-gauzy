<!--
  This is documentation, not SDL, and the extension is what says so.

  The domain contributes no root field and no type: an export streams a file through the HTTP response and
  an import is a multipart upload whose answer is the import ledger row another domain declares. A document
  that declares nothing cannot be a GraphQL document at all — the parser refuses a file with no definition
  ("Unexpected <EOF>"), and the boot composes every `*.gql` under a `schema/` directory — so the explanation
  lives beside where the SDL would have been, in a file the composition does not read.
-->
# The export domain contributes no root field, and this document states why rather than leaving the
# absence to be read as an oversight.
#
# `ExportController` is mounted at `/api/export` under `ALL_ORG_VIEW` and `EXPORT_ADD`, and the three
# routes it serves are all the same kind of answer:
#
#   GET /            — every table of the caller's tenant, written out as CSV, archived and downloaded
#   GET /template    — the same archive, holding one empty CSV per table instead of rows
#   GET /filter      — the same archive, holding the tables the caller names
#
# Each of them answers a **file**: the service writes CSV files into a directory, archives them, streams
# the archive to the response and then deletes both the files and the archive. What arrives at the caller
# is bytes with a content disposition, produced by `res.download`, and what the route's own signature
# says is that it answers nothing at all — the handler is typed `Promise<any>` and returns nothing.
#
# **A downloaded archive is not a field this schema can declare.** GraphQL answers a document: every
# value a field returns is described by a type in the schema, and every type here is a JSON-shaped
# structure of scalars, objects and lists. There is no scalar for a byte stream, and the delivered route
# does not answer one either — it hands the response object to the store and the transfer happens outside
# the value it returns. A field that answered, say, a base64 string would be a different capability rather
# than this one: the archive is written to a temporary path, streamed, and removed, so the bytes exist
# only for the duration of one HTTP response.
#
# Two things follow, and both are stated rather than worked around:
#
# - **No type is declared here.** There is no row behind an export — the domain owns no entity, the
#   archive is assembled from every repository the platform registers, and nothing about it outlives the
#   request. `export.type.md` therefore declares nothing either, and says so.
# - **No mutation is declared for it.** An export would be a read if it were expressible at all: the
#   delivered routes change no row. The reason there is no field is the answer's shape and not a missing
#   capability.
#
# A client that needs an export reaches `GET /api/export` and receives the file, which is the same
# statement this document makes in the other direction: the capability has one surface because it has one
# answer, and that answer is not a value.
