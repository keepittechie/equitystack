import { notFound } from "next/navigation";
import CardPage, { buildCardMetadata } from "@/app/card/CardPage";
import { getPresidentCard } from "@/lib/shareable-cards";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getPresidentCard(slug);

  if (!card) {
    return {
      title: "President Card Not Found",
      description: "The requested president card could not be found on EquityStack.",
    };
  }

  return buildCardMetadata(card);
}

export default async function PresidentCardPage({ params }) {
  const { slug } = await params;
  const card = await getPresidentCard(slug);

  if (!card) {
    notFound();
  }

  return <CardPage card={card} backHref="/presidents" backLabel="Back to Presidents" />;
}
