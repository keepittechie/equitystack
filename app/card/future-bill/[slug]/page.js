import { notFound } from "next/navigation";
import CardPage, { buildCardMetadata } from "@/app/card/CardPage";
import { getFutureBillCard } from "@/lib/shareable-cards";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getFutureBillCard(slug);

  if (!card) {
    return {
      title: "Future Bill Card Not Found",
      description: "The requested future bill card could not be found on EquityStack.",
    };
  }

  return buildCardMetadata(card);
}

export default async function FutureBillCardPage({ params }) {
  const { slug } = await params;
  const card = await getFutureBillCard(slug);

  if (!card) {
    notFound();
  }

  return <CardPage card={card} backHref="/future-bills" backLabel="Back to Future Bills" />;
}
