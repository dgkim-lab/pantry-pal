"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemButton, ListItemText } from "@mui/material";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppGuide({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setInstalled(standalone);
    setIsIos(ios);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      {compact ? (
        <Button color="inherit" size="small" onClick={handleInstall}>Install app</Button>
      ) : (
        <ListItemButton onClick={handleInstall}>
          <ListItemText primary="Install Pantry Pal" />
        </ListItemButton>
      )}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Install Pantry Pal</DialogTitle>
        <DialogContent>
          {isIos
            ? "In Safari, tap Share, then choose Add to Home Screen."
            : "Use your browser’s install icon in the address bar or browser menu to add Pantry Pal to your device."}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
