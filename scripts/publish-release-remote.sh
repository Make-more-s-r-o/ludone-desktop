#!/bin/sh
set -eu

if [ "$#" -lt 3 ]; then
  echo "Použití: publish-release-remote.sh CILOVY_ADRESAR STAGING_NAZEV SOUBOR..." >&2
  exit 2
fi

publish_path=$1
staging_path="$publish_path/$2"
shift 2

verify_sha256sums() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c SHA256SUMS
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c SHA256SUMS
    return
  fi
  echo "Chybí nástroj pro ověření SHA-256 součtů" >&2
  exit 127
}

file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print $1 }'
    return
  fi
  echo "Chybí nástroj pro výpočet SHA-256 součtu" >&2
  exit 127
}

cd "$staging_path"
verify_sha256sums
chmod 0644 "$@"

# Verzované balíčky mohou při opakování téhož workflow už existovat. Přijmeme je
# pouze tehdy, když jsou bitově totožné; stejná verze s jiným obsahem je chyba.
for file do
  [ "$file" = "latest-mac.yml" ] && continue
  if [ -e "$publish_path/$file" ]; then
    [ "$(file_sha256 "$file")" = "$(file_sha256 "$publish_path/$file")" ] \
      || { echo "Cílový $file už existuje s jiným obsahem" >&2; exit 1; }
    rm "$file"
  else
    mv "$file" "$publish_path/$file"
  fi
done

# Jediný pohyblivý ukazatel zveřejníme atomickým rename až po celé sadě.
mv -f latest-mac.yml "$publish_path/latest-mac.yml"
rm SHA256SUMS
rmdir "$staging_path"
