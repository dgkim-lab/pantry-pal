"use client";

import { Button } from "@mui/material";

// Temporary debug control. Remove after client exception reporting is verified.
export function ClientErrorTestButton() {
  return (
    <Button color="warning" size="small" onClick={() => { throw new Error("Pantry Pal client error test"); }}>
      Test client error
    </Button>
  );
}
