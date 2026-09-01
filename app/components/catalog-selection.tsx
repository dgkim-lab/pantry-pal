"use client";

import { createContext, FormEvent, ReactNode, useContext, useState } from "react";
import { Button, MenuItem, TextField } from "@mui/material";
import { addMasterItemsToList } from "@/app/actions";
import { ItemCheckButton } from "@/app/components/item-check-button";

type CatalogItem = { id: string; name: string };
type ShoppingList = { id: string; name: string };

const SelectionContext = createContext<{ selected: Set<string>; toggle: (id: string) => void } | null>(null);

export function CatalogSelection({ items, lists, children }: { items: CatalogItem[]; lists: ShoppingList[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await addMasterItemsToList(new FormData(form));
    setSelected(new Set());
    form.reset();
    document.querySelectorAll<HTMLElement>(".catalog-item[open]").forEach((item) => item.removeAttribute("open"));
    setToast("Items added to your shopping list");
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      {children}
      <aside className="catalog-cart" aria-live="polite">
        <div className="cart-card-heading">
          <div><p className="eyebrow">QUICK ADD</p><h2>Selected items</h2></div>
          <strong className="catalog-cart-count">{selected.size}</strong>
        </div>
        {selected.size === 0 ? (
          <p className="cart-empty">Select catalog items above to add them to a shopping list.</p>
        ) : lists.length === 0 ? (
          <p className="cart-empty">Create a shopping list before adding items.</p>
        ) : (
          <form className="catalog-cart-form" onSubmit={submit}>
            <div className="catalog-selected-names">
              {items.filter((item) => selected.has(item.id)).map((item) => <span key={item.id}>{item.name}</span>)}
            </div>
            <TextField select name="listId" label="Shopping list" defaultValue="" required>
              <MenuItem value="" disabled>Choose a shopping list</MenuItem>
              {lists.map((list) => <MenuItem key={list.id} value={list.id}>{list.name}</MenuItem>)}
            </TextField>
            {Array.from(selected).map((id) => <input key={id} type="hidden" name="masterItemId" value={id} />)}
            <Button variant="contained" type="submit">Add to list</Button>
          </form>
        )}
      </aside>
      {toast && <div className="catalog-toast" role="status">{toast}</div>}
    </SelectionContext.Provider>
  );
}

export function CatalogCheckbox({ item }: { item: CatalogItem }) {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("CatalogCheckbox must be used inside CatalogSelection");
  const checked = context.selected.has(item.id);
  return <span className="catalog-select" onClick={(event) => event.stopPropagation()}><ItemCheckButton checked={checked} onChange={() => context.toggle(item.id)} label={`Select ${item.name}`} /></span>;
}
