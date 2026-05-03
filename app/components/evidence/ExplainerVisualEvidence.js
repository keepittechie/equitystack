import VisualEvidenceBlock from "@/app/components/evidence/VisualEvidenceBlock";

export default function ExplainerVisualEvidence({ items = [] }) {
  return <VisualEvidenceBlock items={items} className="pt-5" />;
}
