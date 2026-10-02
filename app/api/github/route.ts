import { getPortfolioData } from "@/lib/github";
export const revalidate = 1800;
export async function GET() { return Response.json(await getPortfolioData(), { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } }); }
