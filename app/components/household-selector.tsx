"use client";

import { useRef } from "react";
import { MenuItem, Select } from "@mui/material";
import { switchHousehold } from "@/app/actions";

type HouseholdOption = {
  householdId: string;
  household: {
    name: string;
  };
};

type HouseholdSelectorProps = {
  households: readonly HouseholdOption[];
  activeHouseholdId?: string;
};

export function HouseholdSelector({
  households,
  activeHouseholdId,
}: HouseholdSelectorProps) {
  if (households.length < 2) {
    return null;
  }

  const selectedHouseholdId = activeHouseholdId ?? households[0].householdId;
  const formRef = useRef<HTMLFormElement>(null);

  function submitHousehold(householdId: string) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const hiddenInput = form.elements.namedItem("householdId");

    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = householdId;
    }

    form.requestSubmit();
  }

  return (
    <form ref={formRef} action={switchHousehold} aria-label="Switch household">
      <input
        type="hidden"
        name="householdId"
        value={selectedHouseholdId}
      />
      <Select
        value={selectedHouseholdId}
        size="small"
        onChange={(event) => {
          submitHousehold(String(event.target.value));
        }}
        inputProps={{ "aria-label": "Current household" }}
      >
        {households.map(({ householdId, household }) => (
          <MenuItem value={householdId} key={householdId}>
            {household.name}
          </MenuItem>
        ))}
      </Select>
    </form>
  );
}
