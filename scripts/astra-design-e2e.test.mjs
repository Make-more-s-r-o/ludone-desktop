import assert from "node:assert/strict";
import test from "node:test";
import { homeGeometryValid, timelineGeometryValid } from "./astra-design-e2e.mjs";

// Skutečné pozorování Electronu; očekávání funkce pochází z D10 / galerie 0dd87da.
const observedHome = {
  "check": "now-hierarchy-and-safe-actions",
  "futureStatus": "Připravujeme",
  "title": "Pracovní čas se připravuje.",
  "brand": "LuDone",
  "introCopy": "Nahrávání schůzek funguje.",
  "hero": {
    "top": 482.1875,
    "bottom": 525.1875,
    "left": 9,
    "right": 391,
    "width": 382,
    "height": 43
  },
  "record": {
    "top": 123,
    "bottom": 335,
    "left": 9,
    "right": 391,
    "width": 382,
    "height": 212
  },
  "future": {
    "top": 482.1875,
    "bottom": 525.1875,
    "left": 9,
    "right": 391,
    "width": 382,
    "height": 43
  },
  "preview": {
    "top": 335,
    "bottom": 482.1875,
    "left": 9,
    "right": 391,
    "width": 382,
    "height": 147.1875
  },
  "footer": {
    "top": 658,
    "bottom": 692,
    "left": 9,
    "right": 391,
    "width": 382,
    "height": 34
  },
  "viewportHeight": 700,
  "recordActionVisible": true,
  "recordActionEnabled": true,
  "futureControls": [
    {
      "tag": "button",
      "disabled": true,
      "visible": false
    },
    {
      "tag": "input",
      "disabled": true,
      "visible": false
    },
    {
      "tag": "button",
      "disabled": true,
      "visible": false
    }
  ],
  "sourceActionVisible": true,
  "sourceActionEnabled": true,
  "previewTitle": "Nahrávky",
  "previewItems": [
    "Nahrávka30. 9. 2026 15:23 · Méně než minutuZůstává na Macu"
  ],
  "titleFont": "\"Public Sans\", sans-serif",
  "titleAlign": "left",
  "topline": {
    "top": 495.1875,
    "bottom": 513.1875,
    "left": 31,
    "right": 369,
    "width": 338,
    "height": 18
  },
  "navActive": "Teď"
};

test("D10: pozorované Nahrávání první vyhovuje přesnému kontraktu", () => {
  assert.equal(homeGeometryValid(observedHome), true);
});
for (const [name, mutate] of [
  ["návrat dominantního LuTracku", state => { state.future = { ...state.future, top: 123, bottom: 442, height: 319 }; state.record.top = 442; }],
  ["změněná výška nahrávání", state => { state.record.height = 97; }],
  ["chybějící nahrávání", state => { state.record = null; }],
  ["přehled před nahráváním", state => { state.preview.top = 100; }],
  ["viditelný budoucí ovladač", state => { state.futureControls[0].visible = true; }],
  ["aktivní budoucí ovladač", state => { state.futureControls[0].disabled = false; }],
  ["překrytí patičkou", state => { state.footer.top = state.future.bottom - 1; }],
]) {
  test(`D10 odmítne: ${name}`, () => {
    const state = structuredClone(observedHome);
    mutate(state);
    assert.equal(homeGeometryValid(state), false);
  });
}

// Skutečné pozorování dvou lokálních záznamů z Electronu.
const observedTimeline = {
  "check": "astra-layout-day",
  "toolbar": {
    "top": 240.046875,
    "bottom": 269.046875,
    "left": 55,
    "right": 585,
    "width": 530,
    "height": 29
  },
  "notice": {
    "top": 273.046875,
    "bottom": 296.546875,
    "left": 55,
    "right": 585,
    "width": 530,
    "height": 23.5
  },
  "groups": [
    {
      "top": 322.546875,
      "bottom": 341.734375,
      "left": 55,
      "right": 585,
      "width": 530,
      "height": 19.1875
    }
  ],
  "groupKeys": [
    "2026-09-30"
  ],
  "actualGroupKeys": [
    "2026-09-30"
  ],
  "textClipping": false,
  "times": [
    {
      "top": 363.734375,
      "bottom": 387.734375,
      "left": 55,
      "right": 97,
      "width": 42,
      "height": 24
    },
    {
      "top": 491.265625,
      "bottom": 515.265625,
      "left": 55,
      "right": 97,
      "width": 42,
      "height": 24
    }
  ],
  "statuses": [
    {
      "top": 400.578125,
      "bottom": 418.265625,
      "left": 157,
      "right": 241.65625,
      "width": 84.65625,
      "height": 17.6875
    },
    {
      "top": 528.109375,
      "bottom": 545.796875,
      "left": 157,
      "right": 241.65625,
      "width": 84.65625,
      "height": 17.6875
    }
  ],
  "entries": [
    {
      "top": 363.734375,
      "bottom": 461.265625,
      "left": 117,
      "right": 585,
      "width": 468,
      "height": 97.53125
    },
    {
      "top": 491.265625,
      "bottom": 588.796875,
      "left": 117,
      "right": 585,
      "width": 468,
      "height": 97.53125
    }
  ],
  "footer": {
    "top": 691,
    "bottom": 735,
    "left": 9,
    "right": 631,
    "width": 622,
    "height": 44
  },
  "horizontalOverflow": false
};
test("D10: denní skupina má čas a stav bez překryvu", () => {
  assert.equal(timelineGeometryValid(observedTimeline), true);
});
for (const [name, mutate] of [
  ["chybějící skutečný řádek", state => { state.entries.pop(); }],
  ["čas zasahující do nahrávky", state => { state.times[0].right = state.entries[0].left + 1; }],
  ["zkrácený stav", state => { state.textClipping = true; }],
  ["překrytí druhé položky patičkou", state => { state.footer.top = state.entries[1].bottom - 1; }],
  ["nesprávná kalendářní skupina", state => { state.groupKeys = ["2026-09-29"]; }],
]) {
  test(`D10 den odmítne: ${name}`, () => {
    const state = structuredClone(observedTimeline);
    mutate(state);
    assert.equal(timelineGeometryValid(state), false);
  });
}
