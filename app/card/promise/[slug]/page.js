import { notFound } from "next/navigation";
import CardPage, { buildCardMetadata } from "@/app/card/CardPage";
import { getPromiseCard } from "@/lib/shareable-cards";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getPromiseCard(slug);

  if (!card) {
    return {
      title: "Promise Card Not Found",
      description: "The requested promise card could not be found on EquityStack.",
    };
  }

  return buildCardMetadata(card);
}

export default async function PromiseCardPage({ params }) {
  const { slug } = await params;
  const card = await getPromiseCard(slug);

  if (!card) {
    notFound();
  }

  return <CardPage card={card} backHref="/promises" backLabel="Back to Promise Tracker" />;
}
