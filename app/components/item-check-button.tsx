"use client";

import { Checkbox } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

export function ItemCheckButton({ checked, label }: { checked: boolean; label: string }) {
  return (
    <Checkbox
      checked={checked}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      slotProps={{ input: { "aria-label": label } }}
      icon={<RadioButtonUncheckedIcon />}
      checkedIcon={<CheckCircleIcon />}
      color="primary"
      sx={{ p: 0, flex: "none" }}
    />
  );
}
