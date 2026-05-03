import { notFound } from "next/navigation";
import CardPage, { buildCardMetadata } from "@/app/card/CardPage";
import { getExplainerCard } from "@/lib/shareable-cards";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getExplainerCard(slug);

  if (!card) {
    return {
      title: "Explainer Card Not Found",
      description: "The requested explainer card could not be found on EquityStack.",
    };
  }

  return buildCardMetadata(card);
}

export default async function ExplainerCardPage({ params }) {
  const { slug } = await params;
  const card = await getExplainerCard(slug);

  if (!card) {
    notFound();
  }

  return <CardPage card={card} backHref="/explainers" backLabel="Back to Explainers" />;
}
