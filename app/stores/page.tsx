import { redirect } from "next/navigation";
import { Button, MenuItem, TextField } from "@mui/material";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createStore, deleteStore, updateStore } from "@/app/actions";
import { SiteHeader } from "@/app/components/site-header";
import { getActiveMembership } from "@/lib/household";

export default async function StoresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const membership = await getActiveMembership();
  if (!membership) redirect("/households");

  const stores = await prisma.store.findMany({
    where: { householdId: membership.householdId },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-shell">
      <SiteHeader name={session.user.name} />
      <div className="page-wrap">
        <p className="eyebrow">WHERE YOU SHOP</p>
        <h1>Stores</h1>
        <details className="create-panel">
          <summary>＋ Add store</summary>
          <form action={createStore} className="field-grid wide-fields single-column">
            <TextField name="name" placeholder="Store name" label="Store name" required />
            <TextField select name="type" label="Type" defaultValue="LOCAL">
              <MenuItem value="LOCAL">Local market</MenuItem>
              <MenuItem value="ONLINE">Online market</MenuItem>
            </TextField>
            <TextField name="address" placeholder="Address" label="Address" />
            <TextField name="url" placeholder="Website" label="Website" type="url" />
            <TextField name="notes" placeholder="Notes" label="Notes" />
            <Button variant="contained" type="submit">Create store</Button>
          </form>
        </details>
        <section className="catalog-list">
          {stores.map((store) => {
            const address = store.address?.trim();
            const website = store.url?.trim();

            return (
            <details className="catalog-item" key={store.id}>
              <summary>
                <span className="catalog-name">{store.name}</span>
                <span>{store.type === "ONLINE" ? "Online" : "Local"}</span>
              </summary>
              <form action={updateStore} className="field-grid wide-fields single-column">
                <input type="hidden" name="storeId" value={store.id} />
                <TextField name="name" defaultValue={store.name} label="Store name" required />
                <TextField select name="type" label="Type" defaultValue={store.type}>
                  <MenuItem value="LOCAL">Local market</MenuItem>
                  <MenuItem value="ONLINE">Online market</MenuItem>
                </TextField>
                <TextField name="address" defaultValue={store.address ?? ""} placeholder="Address" label="Address" />
                <TextField name="url" defaultValue={store.url ?? ""} placeholder="Website" label="Website" type="url" />
                <TextField name="notes" defaultValue={store.notes ?? ""} placeholder="Notes" label="Notes" />
                <Button variant="outlined" type="submit">Save changes</Button>
              </form>
              <form action={deleteStore}>
                <input type="hidden" name="storeId" value={store.id} />
                <Button color="error" type="submit">Delete store</Button>
              </form>
              {(address || website) && (
                <>
                  <hr className="store-divider" />
                  <div className="store-links">
                    {address && (
                      <>
                        <Button
                          href={`https://maps.apple.com/?address=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noreferrer"
                          variant="outlined"
                          size="small"
                        >
                          Apple Maps
                        </Button>
                        <Button
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noreferrer"
                          variant="outlined"
                          size="small"
                        >
                          Google Maps
                        </Button>
                      </>
                    )}
                    {website && (
                      <Button href={website} target="_blank" rel="noreferrer" variant="outlined" size="small">
                        Website
                      </Button>
                    )}
                  </div>
                </>
              )}
            </details>
            );
          })}
        </section>
      </div>
    </main>
  );
}
