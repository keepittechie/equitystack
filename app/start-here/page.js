import { buildPageMetadata } from "@/lib/metadata";
import { StartPageContent } from "@/app/start/page";

export const metadata = buildPageMetadata({
  title: "Start Here | Guided EquityStack research path",
  description:
    "Follow a guided reading path through EquityStack's core explainers on law, policy, history, and long-term Black outcomes, with clear next steps into reports, sources, and methodology.",
  path: "/start-here",
});

export default function StartHerePage() {
  return <StartPageContent path="/start-here" />;
}
