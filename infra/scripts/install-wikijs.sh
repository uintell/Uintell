#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/x1/projectx"
INSTALL_ROOT="$ROOT_DIR/var/wiki-js"
RELEASES_DIR="$INSTALL_ROOT/releases"
CURRENT_LINK="$INSTALL_ROOT/current"
DATA_DIR="$INSTALL_ROOT/data"
DOWNLOAD_URL="${WIKIJS_DOWNLOAD_URL:-https://github.com/Requarks/wiki/releases/latest/download/wiki-js.tar.gz}"

mkdir -p "$RELEASES_DIR" "$DATA_DIR"

archive_path="$(mktemp /tmp/wiki-js.XXXXXX.tar.gz)"
trap 'rm -f "$archive_path"' EXIT

wget -O "$archive_path" "$DOWNLOAD_URL"

resolved_url="$(curl -fsSLI -o /dev/null -w '%{url_effective}' -L "$DOWNLOAD_URL")"
version="$(basename "$(dirname "$resolved_url")")"
release_dir="$RELEASES_DIR/$version"

rm -rf "$release_dir"
mkdir -p "$release_dir"
tar -xzf "$archive_path" -C "$release_dir"

ln -sfn "$release_dir" "$CURRENT_LINK"

if [[ ! -f "$CURRENT_LINK/config.yml" ]]; then
  cat > "$CURRENT_LINK/config.yml" <<'EOF'
port: 3012

db:
  type: postgres
  host: 127.0.0.1
  port: 5432
  user: wikijs
  pass: changeme
  db: wikijs
  ssl: false
  sslOptions:
    auto: true
  schema: public

ssl:
  enabled: false
  port: 3443
  provider: custom
  format: pem
  key: path/to/key.pem
  cert: path/to/cert.pem
  pfx: path/to/cert.pfx
  passphrase: null
  dhparam: null
  domain: wiki.uintell.org
  subscriberEmail: admin@uintell.org

bindIP: 127.0.0.1
logLevel: info
logFormat: default
offline: false
ha: false
dataPath: /home/x1/projectx/var/wiki-js/data
bodyParserLimit: 5mb
EOF
fi

echo "Installed Wiki.js $version into $release_dir"
echo "Current symlink: $CURRENT_LINK"
echo "Edit $CURRENT_LINK/config.yml before first start."
