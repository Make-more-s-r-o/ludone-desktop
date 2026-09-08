// Vytáhne z `electron/main.cjs` doslovný zdroj jedné funkce, aby ho sondy mohly
// spustit s podstrčenými závislostmi.
//
// 🔴 Proč sdílený modul, a ne kopie v každé sondě: dvě sondy s vlastním výřezovým
// kódem jsou dvě cesty k témuž a rozejdou se tiše — jedna se naučí poznat, že se
// funkce v main.cjs rozdvojila, druhá ne. Tady je ta znalost jednou.
//
// Parsuje se AST, ne regulár: `function foo(` se v souboru vyskytuje i uvnitř
// řetězců a komentářů a výřez podle závorek se dá porazit složenou závorkou
// v řetězci. Zároveň se trvá na PRÁVĚ JEDNÉ deklaraci — kdyby se funkce v main.cjs
// rozdvojila, sonda by jinak tiše měřila tu první.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";

export const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MAIN_ZDROJ = readFileSync(path.join(KOREN, "electron", "main.cjs"), "utf8");

let zapamatovanyKod;

function sourceCode() {
  if (!zapamatovanyKod) {
    const linter = new Linter();
    linter.verify(MAIN_ZDROJ, [{
      languageOptions: { ecmaVersion: "latest", sourceType: "commonjs" },
    }]);
    zapamatovanyKod = linter.getSourceCode();
    if (!zapamatovanyKod) throw new Error("electron/main.cjs se nepodařilo rozparsovat");
  }
  return zapamatovanyKod;
}

/** @param {string} jmeno @returns {string} */
export function zdrojFunkce(jmeno) {
  const uzly = sourceCode().ast.body.filter((uzel) => (
    uzel.type === "FunctionDeclaration" && uzel.id && uzel.id.name === jmeno
  ));
  if (uzly.length !== 1) {
    throw new Error(`Funkce ${jmeno} musí mít v main.cjs právě jednu deklaraci, nalezeno ${uzly.length}`);
  }
  return MAIN_ZDROJ.slice(uzly[0].range[0], uzly[0].range[1]);
}
