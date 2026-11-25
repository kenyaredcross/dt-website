export const dynamic = "force-dynamic";

import Nav from "../components/Nav";
import PartnerPage, { type PartnershipOptions } from "../components/PartnerPage";
import { frappeFetch } from "../lib/frappe";
import { buildMeta } from "../lib/seo";

export const metadata = buildMeta({
  title: "Partner with us | Kenya Red Cross Digital Transformation",
  description:
    "Propose a partnership with the Kenya Red Cross Digital Transformation Department: funding, technical assistance, research, training, technology and more.",
  path: "/partner",
});

export default async function Page() {
  const options = await frappeFetch<PartnershipOptions>(
    "krcs_dt_cms.dt_cms.api.get_partnership_options",
  ).catch((e) => {
    console.error("get_partnership_options failed:", e);
    return null;
  });

  return (
    <>
      <Nav />
      <PartnerPage options={options} />
    </>
  );
}
