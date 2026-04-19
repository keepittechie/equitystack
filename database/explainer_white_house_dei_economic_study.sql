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
  'The White House “Economic Consequences of DEI” Study',
  'Economics',
  'A breakdown of the study’s claims, methodology, and why its conclusions are widely disputed.',
  'The report''s headline estimate depends on a proxy for DEI, not direct measurement of employer DEI policies.
The analysis links higher unexplained minority manager share to lower productivity after 2016, but that correlation does not by itself establish causation.
The model does not directly measure manager qualifications, individual performance, or whether specific hires resulted from DEI programs.
EquityStack treats the study as a policy-relevant claim that should be evaluated through its assumptions before its headline cost estimate is accepted.',
  'The study is a White House economic analysis titled "The Economic Consequences of DEI." It argues that diversity, equity, and inclusion initiatives changed management hiring and promotion patterns after the mid-2010s and that those changes reduced productivity.

The study matters because economic claims like this can be used to justify anti-DEI policy decisions, contracting rules, enforcement priorities, and institutional changes. This explainer focuses only on the study itself: what it claims, how it measures DEI, and what its methodology can and cannot prove.',
  'The main methodological problem is that the study turns a demographic residual into a DEI measure. A state-industry cell having more minority managers than the model predicts may be consistent with DEI activity, but it can also reflect local labor supply, recruitment changes, industry composition, firm growth, geography, education pipelines, occupational sorting, or other post-2016 changes.

Proxy is not proof of policy. Correlation is not causation. The analysis assumes that increased minority representation above the model-predicted level reflects non-merit hiring or promotion, but it does not directly observe hiring criteria, applicant qualifications, manager performance, firm-specific DEI programs, or the actual reason a manager was selected.

Because of that, the model cannot isolate DEI as the causal factor behind lower productivity. It may identify a pattern worth debating, but the pattern depends heavily on the validity of the proxy and on whether other explanations have been ruled out.',
  'The report claims three linked findings. First, it says minority representation in management rose more quickly after the mid-2010s than in the prior period. Second, it says industries with higher values on the study''s DEI proxy became less productive after 2016. Third, it estimates that the resulting productivity loss amounted to roughly $94 billion annually by 2023.

Those are the study''s claims. They are not the same thing as direct evidence that specific DEI policies caused those productivity changes.',
  'The study does not directly measure DEI policies. It uses what it calls "unexplained minority manager share" as a proxy.

In simple terms, the model asks whether a particular industry in a particular state has more minority managers than would be expected after controlling for broader state, industry, and year patterns. The leftover amount is treated as evidence of DEI activity.

That construction is important. A proxy can be useful when direct measurement is difficult, but it is still an indirect measure. It does not show whether a company adopted a DEI policy, whether a promotion was based on that policy, or whether the selected manager was less qualified or less productive.',
  NULL,
  'The study does not prove that minority managers are less qualified.

It does not prove that DEI policies, as actually adopted by specific employers, reduce productivity.

It does not isolate alternative explanations such as labor-market shifts, industry trends, worker sorting, state-level economic changes, remote-work disruption, pandemic-era shocks, technology changes, or other post-2016 changes that may affect productivity.

The report can be read as an argument built from a statistical proxy. It should not be read as direct proof that minority representation itself caused lower productivity.',
  'This matters because economic studies can influence policy even when their identification strategy is contested. A headline estimate, such as a $94 billion annual cost, can travel farther than the assumptions that produced it.

When a model is highly sensitive to a constructed variable, readers should ask how the variable was built, what it actually measures, what it leaves out, and whether the causal claim is stronger than the evidence supports. Weak or assumption-heavy models can still shape real-world decisions.',
  'EquityStack takeaway: separate claims from evidence. The report makes a strong economic claim, but its conclusion depends on treating unexplained minority manager share as evidence of DEI and then treating the resulting productivity relationship as causal.

Policy decisions built on flawed assumptions can have real consequences. The right question is not only what the headline number says, but how the data were constructed, what the model assumes, and what the evidence actually demonstrates.',
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
  AND source_url = '/sources/economic-consequences-of-dei-2026.pdf';

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
);

COMMIT;
