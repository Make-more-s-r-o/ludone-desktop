import { describe, expect, it } from "vitest";
import { formatSize, recordingSizeText } from "../src/lib/format-size.js";

const plain = (text) => text.replace(/\s/gu, " ");

describe("formatSize", () => {
  it("používá desítkové jednotky a českou desetinnou čárku", () => {
    expect(formatSize(999)).toBe("999 B");
    expect(formatSize(1_500)).toBe("2 kB");
    expect(plain(formatSize(46_300_000))).toBe("46,3 MB");
    expect(plain(formatSize(1_000_000))).toBe("1 MB");
  });
  it("neplatnou hodnotu nevymýšlí", () => {
    expect(formatSize(null)).toBe("");
    expect(formatSize(Number.NaN)).toBe("");
  });
});

describe("recordingSizeText", () => {
  it("hlavní údaj je odesílaný soubor, původní stopy zvlášť", () => {
    expect(plain(recordingSizeText({
      uploadBytes: 46_300_000, originalsBytes: 154_000_000, originalsCount: 2,
    }))).toBe("46,3 MB · místně navíc 2 původní stopy 154 MB");
  });
  it("bez odesílaného souboru označí původní stopy a nevymýšlí master", () => {
    expect(plain(recordingSizeText({
      uploadBytes: null, originalsBytes: 200_000_000, originalsCount: 2,
    }))).toBe("původní stopy na Macu 200 MB");
  });
  it("bez čehokoli vrací null", () => {
    expect(recordingSizeText({ uploadBytes: null, originalsBytes: null, originalsCount: 0 })).toBeNull();
  });
});
