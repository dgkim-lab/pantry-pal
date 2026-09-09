"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { addListItem, registerMasterItem } from "@/app/actions";
import { BarcodeScanner } from "@/app/components/barcode-scanner";

type MasterItem = { id: string; name: string };
type PendingMaster = { barcode: string; name: string; attributes: { attributeKey: string; value: string; valueType: "TEXT" | "NUMBER" | "BOOLEAN" }[]; found: boolean };

export function QuickAdd({ listId, items }: { listId: string; items: MasterItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const [pendingMaster, setPendingMaster] = useState<PendingMaster | null>(null);
  const [masterName, setMasterName] = useState("");
  const [toast, setToast] = useState<{ message: string; found: boolean } | null>(null);
  const filteredItems = useMemo(
    () => items.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
    [items, query],
  );

  function close() {
    setOpen(false);
    setQuery("");
  }

  function showToast(found: boolean) {
    setToast({ message: found ? "Product found in Open Food Facts" : "Product not found in Open Food Facts", found });
    window.setTimeout(() => setToast(null), 3200);
  }

  async function processAddResult(result: Awaited<ReturnType<typeof addListItem>>) {
    if (result?.needsMaster) {
      setPendingMaster({ barcode: result.barcode, name: result.product.name, attributes: result.product.attributes, found: result.product.found });
      setMasterName(result.product.name);
      showToast(result.product.found);
      return;
    }
    if (result?.openFoodFactsFound !== undefined) showToast(result.openFoodFactsFound);
    setName("");
    setBarcode("");
    if (result?.cartItemId) router.replace(`${pathname}?highlightCartItem=${encodeURIComponent(result.cartItemId)}`);
  }

  async function handleBarcode(value: string, automaticAdd: boolean) {
    setBarcode(value);
    setName(value);
    if (!automaticAdd) {
      setScannerOpen(false);
      return;
    }

    const formData = new FormData();
    formData.set("listId", listId);
    formData.set("name", value);
    formData.set("barcode", value);
    formData.set("addToCart", "true");
    setScannerOpen(false);
    await processAddResult(await addListItem(formData));
  }

  function clearHighlight() {
    document.querySelectorAll<HTMLElement>(".cart-item-highlight").forEach((element) => element.classList.remove("cart-item-highlight"));
    if (window.location.search.includes("highlightCartItem")) router.replace(pathname);
    setScannerOpen(true);
  }

  async function addCatalogItem(formData: FormData): Promise<void> {
    await addListItem(formData);
  }

  async function submit(formData: FormData) {
    await processAddResult(await addListItem(formData));
  }

  async function submitMaster() {
    if (!pendingMaster || !masterName.trim()) return;
    const formData = new FormData();
    formData.set("listId", listId);
    formData.set("barcode", pendingMaster.barcode);
    formData.set("name", masterName);
    formData.set("attributes", JSON.stringify(pendingMaster.attributes));
    const result = await registerMasterItem(formData);
    setPendingMaster(null);
    if (result?.masterItemId) {
      const addFormData = new FormData();
      addFormData.set("listId", listId);
      addFormData.set("name", masterName);
      addFormData.set("barcode", pendingMaster.barcode);
      addFormData.set("masterItemId", result.masterItemId);
      addFormData.set("addToCart", "true");
      await processAddResult(await addListItem(addFormData));
    }
  }

  return (
    <>
      <form action={submit} className="quick-add">
        <input type="hidden" name="listId" value={listId} />
        <input type="hidden" name="barcode" value={barcode} />
        <input type="hidden" name="addToCart" value={barcode ? "true" : "false"} />
        <IconButton type="button" color="secondary" aria-label="Choose an item from the catalog" onClick={() => setOpen(true)}>
          <AddIcon />
        </IconButton>
        <IconButton type="button" color="secondary" aria-label="Scan a barcode" onClick={clearHighlight}>
          <QrCodeScannerIcon />
        </IconButton>
        <TextField
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add something to your list..."
          aria-label="Add something to your list"
          slotProps={{ htmlInput: { list: "master-items" } }}
        />
        <datalist id="master-items">
          {items.map((item) => <option key={item.id} value={item.name} />)}
        </datalist>
        <Button color="primary" type="submit">Add</Button>
      </form>
      <Drawer anchor="bottom" open={open} onClose={close}>
        <Stack sx={{ p: 2, mx: "auto", width: "min(100%, 640px)", maxHeight: "80vh" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Choose an item</Typography>
          <TextField
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter catalog"
            label="Search items"
            sx={{ mb: 1 }}
          />
          <List sx={{ overflowY: "auto" }}>
            {filteredItems.map((item) => (
              <form action={addCatalogItem} key={item.id}>
                <input type="hidden" name="listId" value={listId} />
                <input type="hidden" name="name" value={item.name} />
                <ListItemButton component="button" type="submit" onClick={close} sx={{ width: "100%", textAlign: "left" }}>
                  <ListItemText primary={item.name} />
                </ListItemButton>
              </form>
            ))}
            {filteredItems.length === 0 && (
              <Typography color="text.secondary" sx={{ p: 2 }}>No catalog items found.</Typography>
            )}
          </List>
        </Stack>
      </Drawer>
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleBarcode} />
      <Dialog open={Boolean(pendingMaster)} onClose={() => setPendingMaster(null)} fullWidth maxWidth="sm">
        <DialogTitle>Register master item</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {pendingMaster?.found ? "We found product information in Open Food Facts. Confirm the item name to save it." : "This product was not found in Open Food Facts. Enter a name to save it."}
          </Typography>
          <Table size="small" sx={{ mb: 2 }} aria-label="Product attributes">
            <TableHead>
              <TableRow>
                <TableCell>Attribute</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingMaster?.attributes.map((attribute) => (
                <TableRow key={attribute.attributeKey}>
                  <TableCell>{attribute.attributeKey}</TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>{attribute.value}</TableCell>
                  <TableCell>{attribute.valueType}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TextField
            autoFocus
            fullWidth
            required
            label="Item name"
            value={masterName}
            onChange={(event) => setMasterName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingMaster(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitMaster()} disabled={!masterName.trim()}>Register and add</Button>
        </DialogActions>
      </Dialog>
      {toast && <div className={`catalog-toast ${toast.found ? "catalog-toast-found" : "catalog-toast-missing"}`} role="status">{toast.message}</div>}
    </>
  );
}
