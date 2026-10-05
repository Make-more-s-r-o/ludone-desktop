const { randomUUID } = require("node:crypto");

// Každá žádost patří jedinému oknu a změně formuláře. Uložení potvrzuje až renderer
// po úspěšném CAS zápisu; tento koordinátor nikdy nespouští upload.
function createDetailCloseGuard({ choose, requestSave }) {
  let dirty = false;
  let epoch = 0;
  let pending = null;
  let busy = false;
  let timer;
  const cancel = () => { clearTimeout(timer); pending = null; busy = false; epoch += 1; };
  return {
    cancel,
    get dirty() { return dirty; },
    setDirty(value) {
      if (typeof value !== "boolean") throw new TypeError("Stav změn musí být boolean");
      dirty = value;
      epoch += 1;
    },
    async request(proceed) {
      if (busy) return;
      if (!dirty) { proceed(); return; }
      busy = true;
      const expected = epoch;
      try {
        const decision = await choose();
        if (expected !== epoch) return;
        if (decision === "discard") { dirty = false; proceed(); }
        else if (decision === "save") {
          const id = randomUUID();
          pending = { id, proceed };
          timer = setTimeout(cancel, 30000);
          timer.unref?.();
          requestSave(id);
        }
      } finally { if (!pending) busy = false; }
    },
    saved(id, success) {
      if (!pending || pending.id !== id || typeof success !== "boolean") throw new TypeError("Neaktuální potvrzení zavření");
      const action = pending;
      cancel();
      if (success && !dirty) action.proceed();
    },
  };
}
module.exports = { createDetailCloseGuard };
