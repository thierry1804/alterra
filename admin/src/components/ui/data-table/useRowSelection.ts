import { useMemo, useState } from "react";

/** Sélection multiple par id, avec état "tout sélectionné"/"partiel" dérivé des ids visibles. */
export function useRowSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleSelectedCount = useMemo(
    () => visibleIds.filter((id) => selected.has(id)).length,
    [visibleIds, selected],
  );

  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return {
    selectedIds: selected,
    selectedCount: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAllVisible,
    allVisibleSelected,
    someVisibleSelected,
    clear,
  };
}
