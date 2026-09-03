"use client";

import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { deletePurchase } from "@/app/actions";

export function PurchaseDeleteButton({ purchaseId }: { purchaseId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button color="error" variant="text" size="small" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={`delete-purchase-title-${purchaseId}`}>
        <DialogTitle id={`delete-purchase-title-${purchaseId}`}>Delete this purchase?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove the purchase and its receipt history. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <form action={deletePurchase}>
            <input type="hidden" name="purchaseId" value={purchaseId} />
            <Button color="error" variant="contained" type="submit" onClick={() => setOpen(false)}>
              Delete purchase
            </Button>
          </form>
        </DialogActions>
      </Dialog>
    </>
  );
}
