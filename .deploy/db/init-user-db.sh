#!/bin/bash
set -e

# Ensure script runs on the default 'postgres' database
psql -U "$POSTGRES_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" | grep -q 1 || \
psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<-EOSQL
    CREATE DATABASE $POSTGRES_DB;
EOSQL

# Explicitly grant privileges, even if the database was pre-created
psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<-EOSQL
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
EOSQL
