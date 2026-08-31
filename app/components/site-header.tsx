"use client";

import { useEffect, useState } from "react";
import { AppBar, Avatar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import { MobileNavigation } from "@/app/components/mobile-navigation";
import { RefreshButton } from "@/app/components/refresh-button";
import { SignOutButton } from "@/app/components/sign-out-button";

export function SiteHeader({ name, listTitle }: { name?: string | null; listTitle?: string }) {
  const [showListTitle, setShowListTitle] = useState(false);

  useEffect(() => {
    if (!listTitle) return;
    const heading = document.getElementById("shopping-list-heading");
    if (!heading) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowListTitle(!entry.isIntersecting),
      { rootMargin: "-76px 0px 0px 0px" },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [listTitle]);

  const brandTitle = showListTitle && listTitle ? listTitle : "pantry pal";

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.appBar }}>
      <Toolbar sx={{ minHeight: 76, px: { xs: 2, md: 6, lg: 12 }, gap: 2 }}>
        <Button href="/lists" color="inherit" sx={{ flexShrink: 0, gap: 1, p: 0, minWidth: 0 }}>
          <Box className="brand-mark small">PP</Box>
          <Typography noWrap sx={{ maxWidth: { xs: "42vw", sm: 280 }, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, letterSpacing: "-.04em" }}>
            {brandTitle}
          </Typography>
        </Button>
        <Stack
          component="nav"
          direction="row"
          spacing={{ xs: 0.25, sm: 1 }}
          aria-label="Primary navigation"
          sx={{ ml: "auto", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", display: { xs: "none", sm: "flex" } }}
        >
          <Button href="/lists" color="inherit" size="small">Lists</Button>
          <Button href="/catalog" color="inherit" size="small">Catalog</Button>
          <Button href="/stores" color="inherit" size="small">Stores</Button>
          <Button href="/history" color="inherit" size="small">History</Button>
        </Stack>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <RefreshButton />
        </Box>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: "#c9d7c7", color: "primary.main", fontWeight: 700 }}>
            {name?.slice(0, 1) ?? "U"}
          </Avatar>
        </Box>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <SignOutButton />
        </Box>
        <Box sx={{ display: { xs: "block", sm: "none" }, ml: "auto" }}>
          <MobileNavigation />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
