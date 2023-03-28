#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
	CREATE DATABASE gauzy;
	GRANT ALL PRIVILEGES ON DATABASE gauzy TO postgres;
EOSQL
