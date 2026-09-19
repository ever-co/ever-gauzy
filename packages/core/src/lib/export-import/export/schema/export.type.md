<!--
  This is documentation, not SDL, and the extension is what says so.

  The domain contributes no root field and no type: an export streams a file through the HTTP response and
  an import is a multipart upload whose answer is the import ledger row another domain declares. A document
  that declares nothing cannot be a GraphQL document at all — the parser refuses a file with no definition
  ("Unexpected <EOF>"), and the boot composes every `*.gql` under a `schema/` directory — so the explanation
  lives beside where the SDL would have been, in a file the composition does not read.
-->
# The export domain declares no object type, and this document is the record of that decision.
#
# Every other `schema/*.type.gql` in this library describes a resource: the row a read answers, the
# connection its list is paged into, the inputs its writes accept. This domain has none of those things.
#
# It has no entity. The archive is assembled at request time from every repository the platform's own
# registry can reach — each table's CSV is produced by reading that table — so there is no row to
# describe and no column to carry.
#
# It has no connection. A list field would answer rows, and the route answers one archive of many files.
#
# It has no input. The two routes that narrow do so through a `data` query member and an `Organization-Id`
# header, and both narrow *which tables are written into the archive* rather than which rows are answered.
#
# The delivered routes themselves are described in `export.api.gql` beside this file, together with the
# reason a streamed download is not a value this schema can declare.
