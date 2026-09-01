"use client";

import { Checkbox, CheckboxProps } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

export function ItemCheckButton({ checked, label, onChange }: { checked: boolean; label: string; onChange?: CheckboxProps["onChange"] }) {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange ?? ((event) => event.currentTarget.form?.requestSubmit())}
      slotProps={{ input: { "aria-label": label } }}
      icon={<RadioButtonUncheckedIcon />}
      checkedIcon={<CheckCircleIcon />}
      color="primary"
      sx={{ p: 0, flex: "none" }}
    />
  );
}
