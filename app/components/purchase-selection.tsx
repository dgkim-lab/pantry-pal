"use client";

import { createContext, FormEvent, ReactNode, useContext, useState } from "react";
import { Button, MenuItem, TextField } from "@mui/material";
import { buyAgain } from "@/app/actions";
import { ItemCheckButton } from "@/app/components/item-check-button";

type PurchaseItem = { id: string; name: string };
type ShoppingList = { id: string; name: string };

const SelectionContext = createContext<{ selected: Set<string>; toggle: (id: string) => void } | null>(null);

export function PurchaseSelection({ items, lists, children }: { items: PurchaseItem[]; lists: ShoppingList[]; children: ReactNode }) {
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
    await buyAgain(new FormData(form));
    setSelected(new Set());
    form.reset();
    setToast("Items added to your shopping list");
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      {children}
      <aside className="catalog-cart purchase-selection-cart" aria-live="polite">
        <div className="cart-card-heading">
          <div><p className="eyebrow">QUICK ADD</p><h2>Selected items</h2></div>
          <strong className="catalog-cart-count">{selected.size}</strong>
        </div>
        {selected.size === 0 ? (
          <p className="cart-empty">Select purchased items above to add them to a shopping list.</p>
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
            {Array.from(selected).map((id) => <input key={id} type="hidden" name="purchaseItemId" value={id} />)}
            <Button variant="contained" type="submit">Add to list</Button>
          </form>
        )}
      </aside>
      {toast && <div className="catalog-toast" role="status">{toast}</div>}
    </SelectionContext.Provider>
  );
}

export function PurchaseCheckbox({ item }: { item: PurchaseItem }) {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("PurchaseCheckbox must be used inside PurchaseSelection");
  return (
    <span className="purchase-select" onClick={(event) => event.stopPropagation()}>
      <ItemCheckButton checked={context.selected.has(item.id)} onChange={() => context.toggle(item.id)} label={`Select ${item.name}`} />
    </span>
  );
}
