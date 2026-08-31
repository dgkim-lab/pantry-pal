import { Box, Typography } from "@mui/material";

export function SiteFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

  return (
    <Box component="footer" className="site-footer">
      <Typography variant="caption">pantry pal</Typography>
      <Typography variant="caption">v{version}</Typography>
    </Box>
  );
}
