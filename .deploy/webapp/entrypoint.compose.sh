#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export WAIT_HOSTS=$API_HOST:$API_PORT

# EVER_APP_LINKS (the app switcher's links) reaches the bundles through sed and lands in a JS string: backslashes
# and quotes are escaped for that string, then for sed (as its own '&' and '|' are), so the app reads the value
# exactly as it was given; line breaks, which no link holds, are dropped.
EVER_APP_LINKS_SED=$(printf '%s' "${EVER_APP_LINKS:-}" | tr -d '\r\n' | sed -e 's/\\/\\\\\\\\/g' -e 's/[&|]/\\&/g' -e "s/'/\\\\\\\\'/g" -e 's/"/\\\\"/g')
export EVER_APP_LINKS_SED

# Use envsubst to create the actual replacements_values.sed file with values from env vars
envsubst < replacements.sed > replacements_values.sed

# Remember every bundle as built: the ones the substitution below changes carry runtime values, and
# nginx must not let browsers keep those for a year (their name does not change when the values do).
md5sum *.js > /tmp/bundles.before.md5

# In production we should replace some values in generated JS code
sed -i -f replacements_values.sed *.js

# Bundles whose bytes changed are revalidated on every load (ETag); the rest stay immutable for a year.
# nginx includes this map from the http block (runtime-config-bundles.conf in both templates).
{
  echo 'map $uri $bundle_cache_control {'
  echo '    default "public, max-age=31536000, immutable";'
  md5sum -c /tmp/bundles.before.md5 2>/dev/null | grep -v ': OK$' | sed 's/: FAILED.*$//' | while read -r bundle; do
    echo "    \"/$bundle\" \"public, no-cache\";"
  done
  echo '}'
} > /etc/nginx/conf.d/runtime-config-bundles.conf
rm -f /tmp/bundles.before.md5

# We need to copy nginx.conf to correct place
envsubst '${API_HOST} ${API_PORT}' < /etc/nginx/conf.d/compose.conf.template > /etc/nginx/nginx.conf

# In Docker Compose we should wait other services start
./wait

exec "$@"
