import Workshop from "@/components/Workshop";
import { getPortfolioData } from "@/lib/github";
export const revalidate = 1800;
export default async function Page() {
  const data = await getPortfolioData();
  return <Workshop data={data} />;
}
