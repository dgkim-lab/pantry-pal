"use client";

import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import {
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { addListItem } from "@/app/actions";
import { BarcodeScanner } from "@/app/components/barcode-scanner";

type MasterItem = { id: string; name: string };

export function QuickAdd({ listId, items }: { listId: string; items: MasterItem[] }) {
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(
    () => items.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
    [items, query],
  );

  function close() {
    setOpen(false);
    setQuery("");
  }

  function handleBarcode(value: string) {
    setBarcode(value);
    setName(value);
    setScannerOpen(false);
  }

  async function submit(formData: FormData) {
    await addListItem(formData);
    setName("");
    setBarcode("");
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
        <IconButton type="button" color="secondary" aria-label="Scan a barcode" onClick={() => setScannerOpen(true)}>
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
              <form action={addListItem} key={item.id}>
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
    </>
  );
}
