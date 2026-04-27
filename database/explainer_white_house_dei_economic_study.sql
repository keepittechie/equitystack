START TRANSACTION;

INSERT INTO explainers (
  slug,
  title,
  category,
  summary,
  key_takeaways,
  intro_text,
  why_it_matters,
  common_claim,
  what_actually_happened,
  timeline_events,
  key_policies_text,
  why_it_still_matters,
  sources_note,
  published
) VALUES (
  'white-house-dei-economic-study',
  'The White House "Economic Consequences of DEI" Study',
  'Economics',
  'A breakdown of the study''s claims, methodology, and why its conclusions are widely disputed.',
  'The report''s headline estimate depends on a proxy for DEI, not direct measurement of employer DEI policies.
The analysis links higher unexplained minority manager share to lower productivity after 2016, but that correlation does not by itself establish causation.
The model does not directly measure manager qualifications, individual performance, or whether specific hires resulted from DEI programs.
EquityStack treats the study as a policy-relevant claim that should be evaluated through its assumptions before its headline cost estimate is accepted.',
  'The study is a White House economic analysis titled "The Economic Consequences of DEI." It argues that diversity, equity, and inclusion initiatives changed management hiring and promotion patterns after the mid-2010s and that those changes reduced productivity.

The study matters because economic claims like this can be used to justify anti-DEI policy decisions, contracting rules, enforcement priorities, and institutional changes. This explainer focuses on the evidence chain: what the study claims, how it measures DEI, what scale its headline estimate asserts, and what its methodology can and cannot prove.',
  'The main methodological problem is that the study turns a demographic residual into a DEI measure. A state-industry cell having more minority managers than the model predicts may be consistent with DEI activity, but it can also reflect local labor supply, recruitment changes, industry composition, firm growth, geography, education pipelines, occupational sorting, or other post-2016 changes.

Proxy is not proof of policy. Correlation is not causation. The analysis assumes that increased minority representation above the model-predicted level reflects non-merit hiring or promotion, but it does not directly observe hiring criteria, applicant qualifications, manager performance, firm-specific DEI programs, or the actual reason a manager was selected.

Because of that, the model cannot isolate DEI as the causal factor behind lower productivity. It may identify a pattern worth debating, but the pattern depends heavily on the validity of the proxy and on whether other explanations have been ruled out.',
  'The report claims three linked findings. First, it says minority representation in management rose more quickly after the mid-2010s than in the prior period. Second, it says industries with higher values on the study''s DEI proxy became less productive after 2016. Third, it estimates that the resulting productivity loss amounted to roughly $94 billion annually by 2023.

Those are the study''s claims. They are not the same thing as direct evidence that specific DEI policies caused those productivity changes.',
  'The study does not directly measure DEI policies. It uses what it calls "unexplained minority manager share" as a proxy.

In simple terms, the model asks whether a particular industry in a particular state has more minority managers than would be expected after controlling for broader state, industry, and year patterns. The leftover amount is treated as evidence of DEI activity.

That construction is important. A proxy can be useful when direct measurement is difficult, but it is still an indirect measure. It does not show whether a company adopted a DEI policy, whether a promotion was based on that policy, or whether the selected manager was less qualified, or whether that manager caused a productivity change.',
  NULL,
  'The study does not prove that minority managers are less qualified.

It does not prove that DEI policies, as actually adopted by specific employers, reduce productivity.

It does not isolate alternative explanations such as labor-market shifts, industry trends, worker sorting, state-level economic changes, remote-work disruption, pandemic-era shocks, technology changes, or other post-2016 changes that may affect productivity.

The report can be read as an argument built from a statistical proxy. It should not be read as direct proof that minority representation itself caused lower productivity.

The Black-impact stakes are not abstract. The study effectively treats unexplained growth in minority managerial representation as evidence of DEI distortion, which can encourage readers to view gains in Black representation as presumptively suspect rather than as a possible sign of reduced exclusion or broader access to opportunity. That is one reason the source base matters: the policy consequence of a weak proxy is not just a technical mistake, but a potential justification for rolling back institutions that address unequal access.',
  'This matters because economic studies can influence policy even when their identification strategy is contested. A headline estimate, such as a $94 billion annual cost, can travel farther than the assumptions that produced it.

When a model is highly sensitive to a constructed variable, readers should ask how the variable was built, what it actually measures, what it leaves out, and whether the causal claim is stronger than the evidence supports. Weak or assumption-heavy models can still shape real-world decisions.

That policy relevance became clearer in 2025 as the administration paired anti-DEI orders and fact sheets with broader arguments that DEI undermines merit, civil rights, and efficiency. Even where a study is not the sole basis for policy, contested economic claims can help legitimize agency action, contractor-rule changes, or public narratives that narrow support for anti-discrimination and equal-opportunity structures.',
  'EquityStack takeaway: separate claims from evidence. The report makes a strong economic claim, but its conclusion depends on treating unexplained minority manager share as evidence of DEI and then treating the resulting productivity relationship as causal.

Policy decisions built on flawed assumptions can have real consequences. The right question is not only what the headline number says, but how the data were constructed, what the model assumes, what Black-impact assumptions are embedded in the model, and what the evidence actually demonstrates.',
  1
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = VALUES(category),
  summary = VALUES(summary),
  key_takeaways = VALUES(key_takeaways),
  intro_text = VALUES(intro_text),
  why_it_matters = VALUES(why_it_matters),
  common_claim = VALUES(common_claim),
  what_actually_happened = VALUES(what_actually_happened),
  timeline_events = VALUES(timeline_events),
  key_policies_text = VALUES(key_policies_text),
  why_it_still_matters = VALUES(why_it_still_matters),
  sources_note = VALUES(sources_note),
  published = VALUES(published);

SET @white_house_dei_explainer_id := (
  SELECT id
  FROM explainers
  WHERE slug = 'white-house-dei-economic-study'
  LIMIT 1
);

DELETE FROM explainer_sources
WHERE explainer_id = @white_house_dei_explainer_id
  AND source_url IN (
    '/sources/economic-consequences-of-dei-2026.pdf',
    'https://www.econometricsociety.org/publications/econometrica/2019/09/01/allocation-talent-and-us-economic-growth',
    'https://www.nber.org/papers/w3894',
    'https://www.nber.org/papers/w22014',
    'https://econjwatch.org/articles/mckinsey-s-diversity-matters-delivers-wins-results-revisited',
    'https://www.sciencedirect.com/org/science/article/pii/S1460106022000347',
    'https://www.whitehouse.gov/fact-sheets/2025/01/fact-sheet-president-donald-j-trump-protects-civil-rights-and-merit-based-opportunity-by-ending-illegal-dei/',
    'https://www.whitehouse.gov/cea/information-resources/'
  );

INSERT INTO explainer_sources (
  explainer_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes,
  display_order
) VALUES (
  @white_house_dei_explainer_id,
  'The Economic Consequences of DEI',
  '/sources/economic-consequences-of-dei-2026.pdf',
  'Government',
  'White House Council of Economic Advisers',
  NULL,
  'Source PDF for the study analyzed in this explainer.',
  1
), (
  @white_house_dei_explainer_id,
  'The Allocation of Talent and U.S. Economic Growth',
  'https://www.econometricsociety.org/publications/econometrica/2019/09/01/allocation-talent-and-us-economic-growth',
  'Academic',
  'Econometrica',
  '2019-09-01',
  'Economic research connecting improved talent allocation to aggregate output growth.',
  2
), (
  @white_house_dei_explainer_id,
  'Continuous Versus Episodic Change: The Impact of Civil Rights Policy on the Economic Status of Blacks',
  'https://www.nber.org/papers/w3894',
  'Academic',
  'National Bureau of Economic Research',
  '1991-11-01',
  'Research on civil-rights policy and Black economic advancement after the mid-1960s.',
  3
), (
  @white_house_dei_explainer_id,
  'Field Experiments on Discrimination',
  'https://www.nber.org/papers/w22014',
  'Academic',
  'National Bureau of Economic Research',
  '2016-02-01',
  'Review of field-experimental evidence on discrimination, its costs, and anti-discrimination interventions.',
  4
), (
  @white_house_dei_explainer_id,
  'McKinsey''s Diversity Matters/Delivers/Wins Results Revisited',
  'https://econjwatch.org/articles/mckinsey-s-diversity-matters-delivers-wins-results-revisited',
  'Academic',
  'Econ Journal Watch',
  '2024-03-01',
  'Academic critique highlighting replication and reverse-causality concerns in business-case diversity studies.',
  5
), (
  @white_house_dei_explainer_id,
  'Board diversity and firm innovation: a meta-analysis',
  'https://www.sciencedirect.com/org/science/article/pii/S1460106022000347',
  'Academic',
  'European Journal of Innovation Management',
  '2022-04-08',
  'Meta-analysis showing a mixed research landscape and a positive association between board diversity and firm innovation.',
  6
), (
  @white_house_dei_explainer_id,
  'Fact Sheet: President Donald J. Trump Protects Civil Rights and Merit-Based Opportunity by Ending Illegal DEI',
  'https://www.whitehouse.gov/fact-sheets/2025/01/fact-sheet-president-donald-j-trump-protects-civil-rights-and-merit-based-opportunity-by-ending-illegal-dei/',
  'Government',
  'The White House',
  '2025-01-22',
  'White House fact sheet showing how anti-DEI policy was framed in merit, contracting, and civil-rights terms during implementation.',
  7
), (
  @white_house_dei_explainer_id,
  'Information & Resources - CEA',
  'https://www.whitehouse.gov/cea/information-resources/',
  'Government',
  'Council of Economic Advisers',
  NULL,
  'White House CEA page listing the Economic Report of the President chapter containing The Economic Consequences of DEI.',
  8
);

COMMIT;
