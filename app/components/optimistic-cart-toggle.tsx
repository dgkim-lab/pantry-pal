"use client";

import { ReactNode, useState } from "react";
import { useFormStatus } from "react-dom";
import { ItemCheckButton } from "@/app/components/item-check-button";

type CartAction = (formData: FormData) => Promise<void>;

function ToggleContents({ checked, name, movingToCart, children }: { checked: boolean; name: string; movingToCart: boolean; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <>
      <ItemCheckButton
        checked={checked}
        label={`${movingToCart ? "Move " : "Remove "}${name} ${movingToCart ? "to" : "from"} cart`}
        disabled={pending}
      />
      <div className="item-copy">
        {children}
        {pending && <span className="item-pending-label">{movingToCart ? "Adding…" : "Removing…"}</span>}
      </div>
    </>
  );
}

export function OptimisticCartToggle({
  action,
  listId,
  itemId,
  name,
  checked: initialChecked,
  children,
}: {
  action: CartAction;
  listId: string;
  itemId: string;
  name: string;
  checked: boolean;
  children: ReactNode;
}) {
  const [checked, setChecked] = useState(initialChecked);

  return (
    <form
      action={action}
      className={`item-row${checked ? " checked" : ""}`}
      onChange={() => setChecked((current) => !current)}
    >
      <input type="hidden" name="listId" value={listId} />
      <input type="hidden" name={checked ? "cartItemId" : "itemId"} value={itemId} />
      <ToggleContents checked={checked} name={name} movingToCart={!initialChecked}>{children}</ToggleContents>
    </form>
  );
}
