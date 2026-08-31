"use client";

import { useState } from "react";
import {
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { SignOutButton } from "@/app/components/sign-out-button";
import { RefreshButton } from "@/app/components/refresh-button";
import { ClientErrorTestButton } from "@/app/components/client-error-test-button";

const links = [
  ["Lists", "/lists"],
  ["Catalog", "/catalog"],
  ["Stores", "/stores"],
  ["History", "/history"],
] as const;

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <IconButton
        color="primary"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </IconButton>
      <Drawer anchor="right" open={open} onClose={close}>
        <Stack sx={{ width: 260, p: 2 }} role="presentation">
          <Typography variant="overline" color="secondary.main" sx={{ px: 2 }}>
            Pantry Pal
          </Typography>
          <List>
            {links.map(([label, href]) => (
              <ListItemButton component="a" href={href} onClick={close} key={href}>
                <ListItemText primary={label} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <Stack sx={{ p: 2 }}>
            <ClientErrorTestButton />
            <RefreshButton />
            <SignOutButton />
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
