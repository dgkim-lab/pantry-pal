"use client";

import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 700);
  }

  return (
    <Tooltip title="Refresh">
      <span>
        <IconButton
          color="primary"
          aria-label="Refresh page"
          onClick={refresh}
          disabled={refreshing}
          size="small"
        >
          <RefreshIcon sx={refreshing ? { animation: "pantry-pal-spin .7s linear infinite" } : undefined} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
