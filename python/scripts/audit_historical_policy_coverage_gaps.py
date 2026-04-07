#!/usr/bin/env python3
import argparse
import csv
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    utc_timestamp,
    write_json_file,
)


TARGET_CATEGORIES = {
    "Housing",
    "Education",
    "Criminal Justice",
    "Voting Rights",
    "Labor",
    "Healthcare",
}

STOPWORDS = {
    "a",
    "an",
    "and",
    "act",
    "acts",
    "amendment",
    "amendments",
    "bill",
    "board",
    "federal",
    "for",
    "in",
    "law",
    "laws",
    "national",
    "of",
    "on",
    "program",
    "programs",
    "the",
    "to",
    "u",
    "us",
    "united",
    "states",
}


LANDMARK_CHECKLIST: list[dict[str, Any]] = [
    {
        "category": "Voting Rights",
        "year": 1870,
        "title": "Fifteenth Amendment",
        "aliases": ["15th Amendment", "Fifteenth Amendment"],
        "why_it_matters": "Foundational constitutional voting-rights guarantee after Reconstruction.",
    },
    {
        "category": "Criminal Justice",
        "year": 1871,
        "title": "Ku Klux Klan Act / Civil Rights Act of 1871",
        "aliases": ["Ku Klux Klan Act", "Civil Rights Act of 1871", "Enforcement Act of 1871"],
        "why_it_matters": "Created federal tools against racial terror and rights intimidation.",
    },
    {
        "category": "Education",
        "year": 1862,
        "title": "Morrill Act of 1862",
        "aliases": ["Morrill Act of 1862", "First Morrill Act"],
        "why_it_matters": "Built the land-grant system whose racially unequal implementation shaped higher-ed opportunity.",
    },
    {
        "category": "Education",
        "year": 1890,
        "title": "Second Morrill Act / 1890 Land-Grant Institutions",
        "aliases": ["Second Morrill Act", "Morrill Act of 1890", "1890 Land-Grant"],
        "why_it_matters": "Created the legal basis for many Black land-grant institutions and HBCU funding equity analysis.",
    },
    {
        "category": "Education",
        "year": 1896,
        "title": "Plessy v. Ferguson",
        "aliases": ["Plessy v Ferguson", "Plessy v. Ferguson"],
        "why_it_matters": "Supreme Court approval of separate-but-equal segregation shaped education and public accommodation policy.",
    },
    {
        "category": "Housing",
        "year": 1917,
        "title": "Buchanan v. Warley",
        "aliases": ["Buchanan v Warley", "Buchanan v. Warley"],
        "why_it_matters": "Early limit on explicit racial zoning, followed by racially exclusionary private and federal practices.",
    },
    {
        "category": "Labor",
        "year": 1935,
        "title": "National Labor Relations Act",
        "aliases": ["National Labor Relations Act", "Wagner Act"],
        "why_it_matters": "Central labor-rights statute; exclusions and enforcement affected Black worker power.",
    },
    {
        "category": "Housing",
        "year": 1933,
        "title": "Home Owners' Loan Corporation redlining maps",
        "aliases": ["Home Owners Loan Corporation", "HOLC", "redlining maps"],
        "why_it_matters": "Federal housing finance risk maps became core evidence for redlining and wealth-gap analysis.",
    },
    {
        "category": "Housing",
        "year": 1934,
        "title": "National Housing Act / FHA underwriting",
        "aliases": ["National Housing Act", "Federal Housing Administration", "FHA"],
        "why_it_matters": "Federal mortgage insurance expanded homeownership while reinforcing racial exclusion.",
    },
    {
        "category": "Labor",
        "year": 1938,
        "title": "Fair Labor Standards Act",
        "aliases": ["Fair Labor Standards Act", "FLSA"],
        "why_it_matters": "Set wage and hour protections while exclusions shaped racialized labor-market effects.",
    },
    {
        "category": "Housing",
        "year": 1937,
        "title": "United States Housing Act of 1937",
        "aliases": ["United States Housing Act of 1937", "Wagner-Steagall"],
        "why_it_matters": "Created the public housing framework that shaped segregation, displacement, and access.",
    },
    {
        "category": "Labor",
        "year": 1941,
        "title": "Executive Order 8802",
        "aliases": ["Executive Order 8802", "Fair Employment Practice Committee", "FEPC"],
        "why_it_matters": "Banned defense-industry discrimination and established wartime federal employment enforcement.",
    },
    {
        "category": "Healthcare",
        "year": 1946,
        "title": "Hill-Burton Act",
        "aliases": ["Hill-Burton", "Hospital Survey and Construction Act"],
        "why_it_matters": "Funded hospital expansion while allowing segregated facilities until later civil-rights enforcement.",
    },
    {
        "category": "Labor",
        "year": 1947,
        "title": "Taft-Hartley Act",
        "aliases": ["Taft-Hartley", "Labor Management Relations Act"],
        "why_it_matters": "Reshaped union power and labor protections with downstream effects on Black worker bargaining power.",
    },
    {
        "category": "Education",
        "year": 1954,
        "title": "Brown v. Board of Education",
        "aliases": ["Brown v Board", "Brown v. Board of Education"],
        "why_it_matters": "Foundational school desegregation ruling.",
    },
    {
        "category": "Housing",
        "year": 1949,
        "title": "Housing Act of 1949 / urban renewal",
        "aliases": ["Housing Act of 1949", "urban renewal"],
        "why_it_matters": "Authorized urban renewal and slum-clearance programs tied to Black displacement.",
    },
    {
        "category": "Voting Rights",
        "year": 1957,
        "title": "Civil Rights Act of 1957",
        "aliases": ["Civil Rights Act of 1957"],
        "why_it_matters": "First civil-rights statute since Reconstruction and an early federal voting-rights enforcement tool.",
    },
    {
        "category": "Voting Rights",
        "year": 1960,
        "title": "Civil Rights Act of 1960",
        "aliases": ["Civil Rights Act of 1960"],
        "why_it_matters": "Expanded federal inspection and record-preservation tools for voting-rights enforcement.",
    },
    {
        "category": "Voting Rights",
        "year": 1964,
        "title": "Twenty-Fourth Amendment",
        "aliases": ["Twenty-Fourth Amendment", "24th Amendment", "poll tax"],
        "why_it_matters": "Banned poll taxes in federal elections.",
    },
    {
        "category": "Labor",
        "year": 1964,
        "title": "Civil Rights Act of 1964 - Title VII",
        "aliases": ["Title VII", "Civil Rights Act of 1964", "Equal Employment Opportunity Commission"],
        "why_it_matters": "Created core employment-discrimination protections and EEOC enforcement.",
    },
    {
        "category": "Healthcare",
        "year": 1965,
        "title": "Social Security Amendments of 1965 / Medicare and Medicaid",
        "aliases": ["Social Security Amendments of 1965", "Medicare", "Medicaid"],
        "why_it_matters": "Created major health-coverage programs and accelerated hospital desegregation enforcement.",
    },
    {
        "category": "Education",
        "year": 1965,
        "title": "Elementary and Secondary Education Act",
        "aliases": ["Elementary and Secondary Education Act", "ESEA"],
        "why_it_matters": "Major federal K-12 funding statute for disadvantaged students and school equity analysis.",
    },
    {
        "category": "Education",
        "year": 1965,
        "title": "Higher Education Act of 1965",
        "aliases": ["Higher Education Act of 1965", "HEA", "Title III"],
        "why_it_matters": "Created durable higher-ed access and institutional-support programs relevant to HBCUs.",
    },
    {
        "category": "Voting Rights",
        "year": 1965,
        "title": "Voting Rights Act of 1965",
        "aliases": ["Voting Rights Act of 1965"],
        "why_it_matters": "Core federal voting-rights enforcement statute.",
    },
    {
        "category": "Criminal Justice",
        "year": 1968,
        "title": "Terry v. Ohio",
        "aliases": ["Terry v Ohio", "Terry v. Ohio"],
        "why_it_matters": "Defined stop-and-frisk doctrine central to policing-disparity analysis.",
    },
    {
        "category": "Housing",
        "year": 1968,
        "title": "Fair Housing Act",
        "aliases": ["Fair Housing Act", "Civil Rights Act of 1968", "Title VIII"],
        "why_it_matters": "Core federal housing-discrimination protection.",
    },
    {
        "category": "Education",
        "year": 1968,
        "title": "Green v. County School Board of New Kent County",
        "aliases": ["Green v County School Board", "New Kent County"],
        "why_it_matters": "Required school systems to dismantle dual systems rather than rely on nominal choice plans.",
    },
    {
        "category": "Voting Rights",
        "year": 1969,
        "title": "Allen v. State Board of Elections",
        "aliases": ["Allen v State Board", "Allen v. State Board of Elections"],
        "why_it_matters": "Expanded interpretation of Voting Rights Act preclearance coverage.",
    },
    {
        "category": "Labor",
        "year": 1970,
        "title": "Occupational Safety and Health Act",
        "aliases": ["Occupational Safety and Health Act", "OSHA"],
        "why_it_matters": "Workplace safety enforcement affects high-risk occupations and racialized labor exposure.",
    },
    {
        "category": "Education",
        "year": 1971,
        "title": "Swann v. Charlotte-Mecklenburg Board of Education",
        "aliases": ["Swann v Charlotte", "Swann v. Charlotte-Mecklenburg"],
        "why_it_matters": "Approved busing and remedial tools for school desegregation.",
    },
    {
        "category": "Labor",
        "year": 1972,
        "title": "Equal Employment Opportunity Act of 1972",
        "aliases": ["Equal Employment Opportunity Act of 1972", "EEOC litigation authority"],
        "why_it_matters": "Strengthened federal employment-discrimination enforcement.",
    },
    {
        "category": "Education",
        "year": 1974,
        "title": "Milliken v. Bradley",
        "aliases": ["Milliken v Bradley", "Milliken v. Bradley"],
        "why_it_matters": "Limited metropolitan desegregation remedies and shaped school-segregation persistence.",
    },
    {
        "category": "Education",
        "year": 1974,
        "title": "Lau v. Nichols",
        "aliases": ["Lau v Nichols", "Lau v. Nichols"],
        "why_it_matters": "Civil-rights education access case affecting language-access enforcement.",
    },
    {
        "category": "Housing",
        "year": 1974,
        "title": "Housing and Community Development Act of 1974",
        "aliases": ["Housing and Community Development Act of 1974", "Community Development Block Grant", "CDBG"],
        "why_it_matters": "Created CDBG and reshaped federal housing/community-development funding.",
    },
    {
        "category": "Housing",
        "year": 1975,
        "title": "Home Mortgage Disclosure Act",
        "aliases": ["Home Mortgage Disclosure Act", "HMDA"],
        "why_it_matters": "Created mortgage-lending disclosure data central to discrimination monitoring.",
    },
    {
        "category": "Housing",
        "year": 1977,
        "title": "Community Reinvestment Act",
        "aliases": ["Community Reinvestment Act", "CRA"],
        "why_it_matters": "Required banks to help meet community credit needs, including historically redlined areas.",
    },
    {
        "category": "Healthcare",
        "year": 1986,
        "title": "Emergency Medical Treatment and Labor Act",
        "aliases": ["Emergency Medical Treatment and Labor Act", "EMTALA"],
        "why_it_matters": "Created emergency-care access requirements relevant to uncompensated care and health access.",
    },
    {
        "category": "Criminal Justice",
        "year": 1986,
        "title": "Anti-Drug Abuse Act of 1986",
        "aliases": ["Anti-Drug Abuse Act of 1986", "100-to-1", "crack cocaine"],
        "why_it_matters": "Created crack/powder sentencing disparities central to racialized incarceration analysis.",
    },
    {
        "category": "Criminal Justice",
        "year": 1987,
        "title": "McCleskey v. Kemp",
        "aliases": ["McCleskey v Kemp", "McCleskey v. Kemp"],
        "why_it_matters": "Limited race-disparity claims in death-penalty constitutional challenges.",
    },
    {
        "category": "Housing",
        "year": 1987,
        "title": "McKinney-Vento Homeless Assistance Act",
        "aliases": ["McKinney-Vento", "Homeless Assistance Act"],
        "why_it_matters": "Core federal homelessness policy with racial equity implications in housing insecurity.",
    },
    {
        "category": "Criminal Justice",
        "year": 1988,
        "title": "Anti-Drug Abuse Act of 1988",
        "aliases": ["Anti-Drug Abuse Act of 1988"],
        "why_it_matters": "Expanded drug-war penalties and enforcement framework.",
    },
    {
        "category": "Healthcare",
        "year": 1991,
        "title": "Healthy Start Initiative",
        "aliases": ["Healthy Start Initiative", "Healthy Start"],
        "why_it_matters": "Maternal and infant health initiative relevant to racial birth-outcome disparities.",
    },
    {
        "category": "Housing",
        "year": 1992,
        "title": "HOPE VI Program",
        "aliases": ["HOPE VI", "Urban Revitalization Demonstration"],
        "why_it_matters": "Public-housing redevelopment program tied to displacement and deconcentration debates.",
    },
    {
        "category": "Labor",
        "year": 1993,
        "title": "Family and Medical Leave Act",
        "aliases": ["Family and Medical Leave Act", "FMLA"],
        "why_it_matters": "Labor-protection baseline for caregiving and health-related leave access.",
    },
    {
        "category": "Voting Rights",
        "year": 1993,
        "title": "National Voter Registration Act",
        "aliases": ["National Voter Registration Act", "Motor Voter"],
        "why_it_matters": "Expanded voter-registration access through motor vehicle and public-assistance systems.",
    },
    {
        "category": "Criminal Justice",
        "year": 1994,
        "title": "Violent Crime Control and Law Enforcement Act",
        "aliases": ["Violent Crime Control", "Crime Control and Law Enforcement Act", "1994 Crime Bill"],
        "why_it_matters": "Major crime statute tied to policing, sentencing, and incarceration effects.",
    },
    {
        "category": "Criminal Justice",
        "year": 1996,
        "title": "Prison Litigation Reform Act",
        "aliases": ["Prison Litigation Reform Act", "PLRA"],
        "why_it_matters": "Restricted incarcerated people ability to litigate prison-conditions claims.",
    },
    {
        "category": "Healthcare",
        "year": 1997,
        "title": "Children's Health Insurance Program",
        "aliases": ["Children's Health Insurance Program", "CHIP", "SCHIP"],
        "why_it_matters": "Expanded child health coverage, relevant to racial coverage gaps.",
    },
    {
        "category": "Voting Rights",
        "year": 2002,
        "title": "Help America Vote Act",
        "aliases": ["Help America Vote Act", "HAVA"],
        "why_it_matters": "Changed election administration after 2000, affecting voting access and verification systems.",
    },
    {
        "category": "Education",
        "year": 2001,
        "title": "No Child Left Behind Act",
        "aliases": ["No Child Left Behind", "NCLB"],
        "why_it_matters": "Major accountability statute with equity claims and disparate implementation effects.",
    },
    {
        "category": "Labor",
        "year": 2009,
        "title": "Lilly Ledbetter Fair Pay Act",
        "aliases": ["Lilly Ledbetter Fair Pay Act"],
        "why_it_matters": "Expanded ability to challenge discriminatory pay practices.",
    },
    {
        "category": "Healthcare",
        "year": 2010,
        "title": "Patient Protection and Affordable Care Act",
        "aliases": ["Affordable Care Act", "Patient Protection and Affordable Care Act", "ACA"],
        "why_it_matters": "Major coverage expansion with measurable racial coverage-gap implications.",
    },
    {
        "category": "Criminal Justice",
        "year": 2010,
        "title": "Fair Sentencing Act",
        "aliases": ["Fair Sentencing Act"],
        "why_it_matters": "Reduced federal crack/powder sentencing disparity.",
    },
    {
        "category": "Voting Rights",
        "year": 2013,
        "title": "Shelby County v. Holder",
        "aliases": ["Shelby County v Holder", "Shelby County v. Holder"],
        "why_it_matters": "Invalidated the Voting Rights Act coverage formula for preclearance.",
    },
    {
        "category": "Criminal Justice",
        "year": 2018,
        "title": "First Step Act",
        "aliases": ["First Step Act"],
        "why_it_matters": "Federal sentencing and prison-reform statute with retroactivity provisions.",
    },
    {
        "category": "Education",
        "year": 2019,
        "title": "FUTURE Act",
        "aliases": ["FUTURE Act", "Fostering Undergraduate Talent"],
        "why_it_matters": "Made permanent mandatory funding for HBCUs and minority-serving institutions.",
    },
    {
        "category": "Criminal Justice",
        "year": 2020,
        "title": "George Floyd Justice in Policing Act",
        "aliases": ["George Floyd Justice in Policing Act", "Justice in Policing"],
        "why_it_matters": "Major federal police-accountability proposal after 2020 protests.",
    },
    {
        "category": "Healthcare",
        "year": 2021,
        "title": "Black Maternal Health Momnibus Act",
        "aliases": ["Black Maternal Health Momnibus", "Momnibus"],
        "why_it_matters": "High-visibility maternal-health package relevant to Black maternal mortality gaps.",
    },
    {
        "category": "Voting Rights",
        "year": 2021,
        "title": "John Lewis Voting Rights Advancement Act",
        "aliases": ["John Lewis Voting Rights Advancement Act"],
        "why_it_matters": "Major proposal to restore and modernize Voting Rights Act preclearance.",
    },
    {
        "category": "Education",
        "year": 2023,
        "title": "Students for Fair Admissions v. Harvard and UNC",
        "aliases": ["Students for Fair Admissions", "SFFA", "Harvard", "UNC"],
        "why_it_matters": "Supreme Court affirmative-action ruling affecting higher-ed admissions equity.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only Missing Policy Report by decade and major historical policy category."
    )
    parser.add_argument("--output", type=Path, help="Missing Policy Report JSON path")
    parser.add_argument("--csv-output", type=Path, help="Optional CSV export path")
    parser.add_argument("--include-archived", action="store_true", help="Include archived policies")
    parser.add_argument(
        "--match-threshold",
        type=float,
        default=0.82,
        help="Title similarity threshold for possible existing matches (default: 0.82)",
    )
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "historical-policy-coverage-gap-report.json"


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_for_match(value: Any) -> str:
    text = normalize_text(value).lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return normalize_text(text)


def tokenize(value: Any) -> set[str]:
    tokens = set()
    for token in normalize_for_match(value).split():
        if len(token) < 3 or token in STOPWORDS:
            continue
        tokens.add(token)
    return tokens


def decade_for_year(year: Any) -> str:
    if year is None:
        return "unknown"
    decade = (int(year) // 10) * 10
    return f"{decade}s"


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def fetch_policies(cursor, include_archived: bool) -> list[dict[str, Any]]:
    where = "" if include_archived else "WHERE COALESCE(p.is_archived, 0) = 0"
    cursor.execute(
        f"""
        SELECT
          p.id AS policy_id,
          p.title,
          p.summary,
          p.outcome_summary,
          p.impact_direction,
          p.year_enacted AS year,
          COALESCE(ps.directness_score, 0) AS directness_score,
          COALESCE(ps.material_impact_score, 0) AS material_impact_score,
          COALESCE(ps.evidence_score, 0) AS evidence_score,
          COALESCE(ps.durability_score, 0) AS durability_score,
          COALESCE(ps.equity_score, 0) AS equity_score,
          COALESCE(ps.harm_offset_score, 0) AS harm_offset_score,
          GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories
        FROM policies p
        LEFT JOIN policy_scores ps ON ps.policy_id = p.id
        LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
        LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
        {where}
        GROUP BY
          p.id,
          p.title,
          p.summary,
          p.outcome_summary,
          p.impact_direction,
          p.year_enacted,
          ps.directness_score,
          ps.material_impact_score,
          ps.evidence_score,
          ps.durability_score,
          ps.equity_score,
          ps.harm_offset_score
        """
    )
    rows = []
    for row in cursor.fetchall() or []:
        categories = [item.strip() for item in str(row.get("categories") or "").split(",") if item.strip()]
        impact_score = (
            (int(row["directness_score"] or 0) * 2)
            + (int(row["material_impact_score"] or 0) * 2)
            + int(row["evidence_score"] or 0)
            + int(row["durability_score"] or 0)
            + (int(row["equity_score"] or 0) * 2)
            - int(row["harm_offset_score"] or 0)
        )
        rows.append(
            {
                "policy_id": int(row["policy_id"]),
                "title": row.get("title"),
                "summary": row.get("summary"),
                "outcome_summary": row.get("outcome_summary"),
                "impact_direction": row.get("impact_direction"),
                "year": int(row["year"]) if row.get("year") is not None else None,
                "decade": decade_for_year(row.get("year")),
                "categories": categories,
                "impact_score": impact_score,
                "match_text": normalize_for_match(
                    " ".join(
                        [
                            str(row.get("title") or ""),
                            str(row.get("summary") or ""),
                            str(row.get("outcome_summary") or ""),
                        ]
                    )
                ),
                "title_match_text": normalize_for_match(row.get("title")),
                "title_tokens": tokenize(row.get("title")),
            }
        )
    return rows


def build_existing_coverage(policies: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    coverage: dict[str, dict[str, Any]] = defaultdict(dict)
    for policy in policies:
        decade = policy["decade"]
        for category in policy["categories"]:
            if category not in TARGET_CATEGORIES:
                continue
            bucket = coverage[decade].setdefault(
                category,
                {
                    "existing_policy_count": 0,
                    "positive_count": 0,
                    "negative_count": 0,
                    "mixed_count": 0,
                    "blocked_count": 0,
                    "top_existing_policies": [],
                },
            )
            bucket["existing_policy_count"] += 1
            direction = str(policy.get("impact_direction") or "unknown").lower()
            if direction == "positive":
                bucket["positive_count"] += 1
            elif direction == "negative":
                bucket["negative_count"] += 1
            elif direction == "mixed":
                bucket["mixed_count"] += 1
            elif direction == "blocked":
                bucket["blocked_count"] += 1
            bucket["top_existing_policies"].append(
                {
                    "policy_id": policy["policy_id"],
                    "title": policy["title"],
                    "year": policy["year"],
                    "impact_score": policy["impact_score"],
                    "impact_direction": policy["impact_direction"],
                }
            )
    for decade_bucket in coverage.values():
        for category_bucket in decade_bucket.values():
            category_bucket["top_existing_policies"] = sorted(
                category_bucket["top_existing_policies"],
                key=lambda item: (-(item["impact_score"] or 0), item["year"] or 9999, item["policy_id"]),
            )[:5]
    return {decade: dict(categories) for decade, categories in sorted(coverage.items())}


def find_matches(item: dict[str, Any], policies: list[dict[str, Any]], match_threshold: float) -> list[dict[str, Any]]:
    aliases = [item["title"], *item.get("aliases", [])]
    alias_texts = [normalize_for_match(alias) for alias in aliases if normalize_for_match(alias)]
    alias_tokens = [(alias, tokenize(alias)) for alias in aliases if tokenize(alias)]
    matches = []
    for policy in policies:
        best_score = 0.0
        best_reason = ""
        for alias, alias_text in zip(aliases, alias_texts, strict=False):
            if alias_text and alias_text in policy["match_text"]:
                best_score = max(best_score, 1.0)
                best_reason = f"alias text matched existing policy text: {alias}"
        for alias, tokens in alias_tokens:
            token_score = jaccard(tokens, policy["title_tokens"])
            title_ratio = ratio(normalize_for_match(alias), policy["title_match_text"])
            candidate_score = max(token_score, title_ratio)
            if candidate_score > best_score:
                best_score = candidate_score
                best_reason = f"title similarity to alias: {alias}"
        if best_score >= match_threshold:
            matches.append(
                {
                    "policy_id": policy["policy_id"],
                    "title": policy["title"],
                    "year": policy["year"],
                    "categories": policy["categories"],
                    "impact_direction": policy["impact_direction"],
                    "impact_score": policy["impact_score"],
                    "match_score": round(best_score, 4),
                    "match_rationale": best_reason,
                }
            )
    return sorted(matches, key=lambda row: (-row["match_score"], row["year"] or 9999, row["policy_id"]))[:5]


def classify_checklist_item(item: dict[str, Any], policies: list[dict[str, Any]], match_threshold: float) -> dict[str, Any]:
    matches = find_matches(item, policies, match_threshold)
    status = "missing_candidate"
    if matches:
        top_score = matches[0]["match_score"]
        status = "covered" if top_score >= 0.96 else "possible_existing_match"
    return {
        "decade": decade_for_year(item["year"]),
        "category": item["category"],
        "year": item["year"],
        "title": item["title"],
        "coverage_status": status,
        "why_it_matters": item["why_it_matters"],
        "suggested_source_classes": [
            "official statutory text or court opinion",
            "Congress.gov / Federal Register / National Archives where applicable",
            "agency history or CRS report for implementation context",
        ],
        "possible_matches": matches,
        "operator_next_step": (
            "If absent, add as a curated historical policy record with authoritative sources. "
            "If a possible match exists, review for alias/canonicalization rather than creating a duplicate."
        ),
    }


def build_missing_policy_report(classified_items: list[dict[str, Any]]) -> dict[str, dict[str, list[dict[str, Any]]]]:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for item in classified_items:
        if item["coverage_status"] == "covered":
            continue
        grouped[item["decade"]][item["category"]].append(item)
    output: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for decade in sorted(grouped):
        output[decade] = {}
        for category in sorted(grouped[decade]):
            output[decade][category] = sorted(
                grouped[decade][category],
                key=lambda item: (item["year"], item["title"]),
            )
    return output


def flatten_missing_report(missing_report: dict[str, dict[str, list[dict[str, Any]]]]) -> list[dict[str, Any]]:
    rows = []
    for decade, categories in missing_report.items():
        for category, items in categories.items():
            for item in items:
                rows.append(item)
    return rows


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "decade",
        "category",
        "year",
        "title",
        "coverage_status",
        "why_it_matters",
        "possible_matches",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "decade": row["decade"],
                    "category": row["category"],
                    "year": row["year"],
                    "title": row["title"],
                    "coverage_status": row["coverage_status"],
                    "why_it_matters": row["why_it_matters"],
                    "possible_matches": "; ".join(
                        f'{match["policy_id"]}: {match["title"]}' for match in row.get("possible_matches", [])
                    ),
                }
            )


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            policies = fetch_policies(cursor, args.include_archived)
    classified_items = [
        classify_checklist_item(item, policies, args.match_threshold)
        for item in LANDMARK_CHECKLIST
        if item["category"] in TARGET_CATEGORIES
    ]
    missing_report = build_missing_policy_report(classified_items)
    gap_rows = flatten_missing_report(missing_report)
    status_counts = Counter(item["coverage_status"] for item in classified_items)
    category_gap_counts = Counter(row["category"] for row in gap_rows)
    decade_gap_counts = Counter(row["decade"] for row in gap_rows)
    return {
        "workflow": "historical_policy_coverage_gap_audit",
        "title": "Missing Policy Report",
        "generated_at": utc_timestamp(),
        "mode": "read_only",
        "scope": {
            "target_categories": sorted(TARGET_CATEGORIES),
            "landmark_checklist_count": len(classified_items),
            "matching_method": (
                "Conservative title/alias/summary text matching against existing policies. "
                "Missing candidates require operator review before import."
            ),
        },
        "summary": {
            "policies_audited": len(policies),
            "checklist_items": len(classified_items),
            "missing_or_review_candidate_count": len(gap_rows),
            "missing_candidate_count": status_counts.get("missing_candidate", 0),
            "possible_existing_match_count": status_counts.get("possible_existing_match", 0),
            "covered_count": status_counts.get("covered", 0),
            "gap_count_by_category": dict(sorted(category_gap_counts.items())),
            "gap_count_by_decade": dict(sorted(decade_gap_counts.items())),
            "database_mutated": False,
        },
        "existing_coverage_by_decade_category": build_existing_coverage(policies),
        "missing_policy_report": missing_report,
        "all_checklist_items": classified_items,
        "operator_guidance": [
            "Review possible_existing_match items before creating new records; they may need alias/canonicalization.",
            "Treat missing_candidate rows as ingestion candidates, not proof of absence without source review.",
            "Prioritize official statutory text, court opinions, agency histories, CRS, National Archives, and primary government sources.",
        ],
    }


def main() -> None:
    args = parse_args()
    output_path = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output_path, report)
    if args.csv_output:
        write_csv(args.csv_output.resolve(), flatten_missing_report(report["missing_policy_report"]))
    print_json({"ok": True, "output": str(output_path), **report["summary"]})


if __name__ == "__main__":
    main()
