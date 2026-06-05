import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Forward id_token so AppBridgeAuth can exchange it on the products page
  const destination = sp.id_token
    ? `/products?id_token=${encodeURIComponent(sp.id_token)}`
    : "/products";
  redirect(destination);
}
