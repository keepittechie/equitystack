const SYSTEM_BREAKDOWN_ARTIFACTS = {
  "/images/evidence/systems/system-section-2-vote-dilution-flow.png": {
    steps: [
      {
        title: "District lines crack or pack voters",
        detail:
          "Splits or concentrates cohesive voting blocs before district results are counted.",
      },
      {
        title: "Fewer effective districts remain",
        detail:
          "That leaves fewer places where voters can elect candidates of choice.",
      },
      {
        title: "Representation falls below population share",
        detail:
          "A large statewide presence still may not produce matching seat outcomes.",
      },
    ],
  },
  "/images/evidence/systems/system-redlining-homeownership-flow.png": {
    steps: [
      {
        title: "Redlining policy restricts mortgage access",
        detail:
          "Appraisal rules and underwriting standards route fair credit away from Black neighborhoods.",
      },
      {
        title: "Homeownership grows more slowly",
        detail:
          "Fewer families gain the equity growth tied to the main housing asset.",
      },
      {
        title: "Wealth transfer stays lower",
        detail:
          "Less home equity can be passed to the next generation over time.",
      },
    ],
  },
  "/images/evidence/systems/system-breakdown-tariff-pass-through-2026.png": {
    steps: [
      {
        title: "CBP collects the tariff from the importer",
        detail:
          "The duty is paid during the U.S. import process when the goods enter the country.",
      },
      {
        title: "The importer's landed cost rises",
        detail:
          "The firm can absorb some margin pressure, negotiate, switch sourcing, or raise prices downstream.",
      },
      {
        title: "Households pay more when costs are passed through",
        detail:
          "The burden can end up in U.S. business costs and consumer prices rather than a foreign treasury.",
      },
    ],
  },
  "/images/evidence/systems/system-breakdown-student-loan-relief-mobility-2024.png": {
    steps: [
      {
        title: "Relief lowers the loan burden",
        detail:
          "Cancellation, discharge, or lower required payments reduce the monthly or default-related pressure tied to the loan.",
      },
      {
        title: "Budget and credit strain ease",
        detail:
          "Borrowers can gain more room to save, stay current on other bills, or recover credit standing.",
      },
      {
        title: "Later mobility decisions become more reachable",
        detail:
          "Some borrowers can move bigger purchases, medical care, or later homeownership plans forward sooner.",
      },
    ],
  },
  "/images/evidence/systems/system-breakdown-bail-reform-pretrial-detention-2026.png":
    {
      steps: [
        {
          title: "Arrest triggers a fast pretrial release decision",
          detail:
            "After a complaint-warrant arrest, New Jersey's reformed system moves the defendant to a first appearance and release decision on a short timetable.",
        },
        {
          title: "Money bail no longer decides release by itself",
          detail:
            "Judges can impose release conditions or order detention based on risk instead of using a modest dollar amount as the main gate.",
        },
        {
          title: "Fewer people stay jailed only because they cannot pay",
          detail:
            "That changes who sits in jail before trial, even though high-risk defendants can still be detained and monitored under the new system.",
        },
      ],
    },
  "/images/evidence/systems/system-bootstraps-opportunity-flow.png": {
    steps: [
      {
        title: "Public systems build opportunity ladders",
        detail:
          "Land, credit, labor protection, and college work as structured entry points.",
      },
      {
        title: "Black families reach those ladders on narrower terms",
        detail:
          "Access exists, but gatekeeping and terms are not equal across the system.",
      },
      {
        title: "Later wealth gaps reflect that structure",
        detail:
          "Outcome differences do not show that everyone climbed with the same ladder.",
      },
    ],
  },
  "/images/evidence/systems/system-gi-bill-access-flow.png": {
    steps: [
      {
        title: "GI Bill opens college and home-loan channels",
        detail:
          "The law builds two major postwar mobility lanes into education and homeownership.",
      },
      {
        title: "Segregated campuses and discriminatory lenders narrow access",
        detail:
          "Black veterans then meet unequal colleges, HBCU capacity limits, and unequal mortgage markets.",
      },
      {
        title: "Postwar gains compound unevenly",
        detail:
          "Degrees, homeownership, and later wealth-building rise through different doors.",
      },
    ],
  },
  "/images/evidence/systems/system-homestead-access-flow.png": {
    steps: [
      {
        title: "The statute opens a land-claim path",
        detail:
          "Formal eligibility creates a paper route into land ownership.",
      },
      {
        title: "Capital, safety, and weak protection narrow usable access",
        detail:
          "Formerly enslaved families still face missing tools, violence, and short-lived federal support.",
      },
      {
        title: "Less land becomes inherited wealth",
        detail:
          "Unequal ability to keep claims limits one of the earliest public asset ladders.",
      },
    ],
  },
  "/images/evidence/systems/system-new-deal-exclusion-flow.png": {
    steps: [
      {
        title: "Coverage rules leave key worker groups outside",
        detail:
          "Early social insurance and labor protections did not start with equal reach across occupations.",
      },
      {
        title: "Housing and local gatekeepers narrow practical access",
        detail:
          "Mortgage systems, employers, and local institutions then shaped who could convert policy into security.",
      },
      {
        title: "Broad programs still deliver unequal security",
        detail:
          "National expansion and unequal practical reach can operate at the same time.",
      },
    ],
  },
  "/images/evidence/systems/system-mass-incarceration-policy-flow.png": {
    steps: [
      {
        title: "Drug and sentencing laws raise penalties and leverage",
        detail:
          "Mandatory minimums and punitive statutes increase the punishment built into the case.",
      },
      {
        title: "Charging, pleas, and time served expand confinement",
        detail:
          "System pressure then shapes who enters prison and how long the sentence lasts.",
      },
      {
        title: "Community harm extends beyond the cell",
        detail:
          "Concentrated imprisonment spreads to earnings, family stability, and civic life.",
      },
    ],
  },
};

export function hasSystemBreakdownArtifact(imagePath) {
  return Boolean(SYSTEM_BREAKDOWN_ARTIFACTS[imagePath]);
}

function FlowConnector() {
  return (
    <div className="flex items-center justify-center border-b border-[var(--line)] py-2 text-[var(--accent)] md:border-b-0">
      <span className="font-mono text-sm md:hidden" aria-hidden="true">
        v
      </span>
      <span className="hidden font-mono text-sm md:inline" aria-hidden="true">
        -&gt;
      </span>
    </div>
  );
}

function FlowStep({ index, title, detail, isLast }) {
  return (
    <div
      className={`min-w-0 px-3 py-3 md:px-4 md:py-4 ${
        isLast ? "" : "border-b border-[var(--line)] md:border-b-0"
      }`}
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        [{index + 1}]
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-white md:text-[15px]">
        {title}
      </p>
      <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)] md:text-[13px]">
        {detail}
      </p>
    </div>
  );
}

export default function SystemBreakdownArtifact({ imagePath, alt }) {
  const artifact = SYSTEM_BREAKDOWN_ARTIFACTS[imagePath];
  if (!artifact) {
    return null;
  }

  const { steps } = artifact;

  return (
    <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[rgba(5,11,19,0.58)]">
      <p className="sr-only">{alt}</p>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Mechanism flow
        </p>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          3 linked steps
        </p>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)_44px_minmax(0,1fr)] md:items-stretch">
        {steps.map((step, index) => (
          <div key={`${imagePath}-step-${index}`} className="contents">
            <FlowStep
              index={index}
              title={step.title}
              detail={step.detail}
              isLast={index === steps.length - 1}
            />
            {index < steps.length - 1 ? <FlowConnector /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
