import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // 🔴 Zákaz skutečné sítě v testech. Bez něj sada volala ŽIVÝ server: každý běh poslal
    // na labs šest pokusů o obnovu tokenu a dva dotazy na firmy, všechny odmítnuté — a
    // zůstal zelený, protože se kontroloval jen odvozený stav. Soubor záměrně nekončí na
    // `.test.js`, aby ho `include` výš nesebral jako testovací soubor.
    setupFiles: ["./tests/setup-no-network.js"],
  },
});
