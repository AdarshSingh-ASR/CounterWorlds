import { CounterWorldsApp } from "../../../components/CounterWorldsApp";

export default async function ShowcasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CounterWorldsApp mode="showcase" showcaseSlug={slug} />;
}
