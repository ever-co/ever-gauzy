<!--
  This is documentation, not SDL, and the extension is what says so.

  The domain contributes no root field and no type: an export streams a file through the HTTP response and
  an import is a multipart upload whose answer is the import ledger row another domain declares. A document
  that declares nothing cannot be a GraphQL document at all — the parser refuses a file with no definition
  ("Unexpected <EOF>"), and the boot composes every `*.gql` under a `schema/` directory — so the explanation
  lives beside where the SDL would have been, in a file the composition does not read.
-->
# The import domain contributes no root field, and this document states why rather than leaving the
# absence to be read as an oversight.
#
# `ImportController` is mounted at `/api/import` and serves one route, `POST /api/import`, under
# `ALL_ORG_EDIT` and `IMPORT_ADD`. Its body is not a document: the route is a multipart upload, and the
# handler receives the stored file rather than the request body — `@UploadedFileStorage()` is the file
# the platform's own storage provider wrote, and the handler reads its `key`, its `originalname` and its
# size off that record. The import format is a ZIP of CSVs, and the interceptor refuses anything else
# before it is stored.
#
# **Its answer is a ledger row, and that row is a type this schema does declare — in the domain that owns
# it.** The handler unzips the archive, parses each CSV into the table it names, adds the caller to the
# imported organizations, and then dispatches `ImportHistoryCreateCommand`, answering the `ImportHistory`
# row it wrote. A failure is answered the same way, with the ledger row's status stating that the import
# failed rather than the request being refused. So the delivered answer is not flattened here, and it is
# not restated here either: `ImportHistory` is declared once, by `export-import/import-history`, and the
# connection over it is that domain's root field.
#
# **Why there is no mutation over this route.** A GraphQL field's arguments are values described by types
# in the schema, and the one value this route needs — an uploaded archive — is not one. The platform's
# schema declares no upload scalar, the endpoint is not configured to accept a multipart GraphQL request,
# and the file this route reads is the record the HTTP interceptor wrote rather than anything the handler
# was given. A field taking a path, a key or a base64 body would be a *different* capability: it would
# have to reproduce the storage step, the format filter and the size limit that the delivered route
# enforces at the transport, and it would let a caller name any file the server can read.
#
# No type is declared in `import.type.md` beside this file, for the same reason: the domain owns no
# entity — the rows it writes belong to the tables the archive names, and the ledger row belongs to the
# import-history domain. A client that needs an import reaches `POST /api/import`, and reads what became
# of it through `importHistories`.
