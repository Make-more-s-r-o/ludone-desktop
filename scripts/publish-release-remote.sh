#!/bin/sh
set -eu

if [ "$#" -lt 3 ]; then
  echo "Použití: publish-release-remote.sh CILOVY_ADRESAR STAGING_NAZEV SOUBOR..." >&2
  exit 2
fi

publish_path=$1
staging_path="$publish_path/$2"
shift 2

cd "$staging_path"
sha256sum -c SHA256SUMS
chmod 0644 "$@"

# Verzované balíčky mohou při opakování téhož workflow už existovat. Přijmeme je
# pouze tehdy, když jsou bitově totožné; stejná verze s jiným obsahem je chyba.
for file do
  [ "$file" = "latest-mac.yml" ] && continue
  if [ -e "$publish_path/$file" ]; then
    [ "$(sha256sum "$file" | cut -d ' ' -f 1)" = "$(sha256sum "$publish_path/$file" | cut -d ' ' -f 1)" ] \
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
