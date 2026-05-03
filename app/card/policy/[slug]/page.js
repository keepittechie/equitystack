import { notFound } from "next/navigation";
import CardPage, { buildCardMetadata } from "@/app/card/CardPage";
import { getPolicyCard } from "@/lib/shareable-cards";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getPolicyCard(slug);

  if (!card) {
    return {
      title: "Policy Card Not Found",
      description: "The requested policy card could not be found on EquityStack.",
    };
  }

  return buildCardMetadata(card);
}

export default async function PolicyCardPage({ params }) {
  const { slug } = await params;
  const card = await getPolicyCard(slug);

  if (!card) {
    notFound();
  }

  return <CardPage card={card} backHref="/policies" backLabel="Back to Policies" />;
}
