import { AppBar, Avatar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import { MobileNavigation } from "@/app/components/mobile-navigation";
import { RefreshButton } from "@/app/components/refresh-button";
import { SignOutButton } from "@/app/components/sign-out-button";

export function SiteHeader({ name }: { name?: string | null }) {
  return (
    <AppBar position="static" color="inherit" elevation={0}>
      <Toolbar sx={{ minHeight: 76, px: { xs: 2, md: 6, lg: 12 }, gap: 2 }}>
        <Button href="/lists" color="inherit" sx={{ flexShrink: 0, gap: 1, p: 0, minWidth: 0 }}>
          <Box className="brand-mark small">PP</Box>
          <Typography sx={{ fontWeight: 700, letterSpacing: "-.04em" }}>pantry pal</Typography>
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
