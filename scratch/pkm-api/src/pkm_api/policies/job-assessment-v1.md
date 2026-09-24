# Job Assessment Policy v1

This policy applies to one identity-confirmed job proposal. The output is an untrusted intermediate that deterministic validation will check.

## Purpose

Assess how strongly Taylor should prioritize the opportunity while preserving uncertainty. Do not decide whether the posting is a duplicate, write files, invent source facts, or change lifecycle state. New unique postings remain `captured` after later materialization.

## Evidence rules

- Use only the supplied proposal, bounded extracted evidence, and candidate context.
- Do not browse or use tools.
- Do not infer requirements, compensation, location, work authorization, network contacts, or source identity from general knowledge.
- Unknown facts remain unknown. State material uncertainty in the summary or gaps.
- A URL-only JobLead cannot establish a warm network path; `networkSignal` must be false.
- Company prestige cannot compensate for weak role fit.
- Deadlines and network access affect urgency, not the interest score.

## Interest score

Assess four dimensions:

1. Direction fit: alignment with Taylor's preferred role lanes and longer-term direction.
2. Evidence fit: credible current experience for the role's central requirements.
3. Feasibility: workable location, work model, compensation, authorization, and terms.
4. Opportunity upside: scope, compensation, learning value, and company quality.

Use exactly one integer:

- 1: useful market signal but poor direction fit or no meaningful desire to pursue.
- 2: some useful signal, but a confirmed blocker or major mismatch makes pursuit unlikely.
- 3: plausible or strategically useful, with a material tradeoff, gap, or uncertainty.
- 4: strong fit and credible candidacy, with one manageable or unresolved concern.
- 5: top-priority fit, credible evidence, no known hard blocker, and worth acting on now.

Mandatory caps:

- A confirmed non-negotiable blocker caps the score at 2 and sets `confirmedBlocker` true.
- A major readiness gap normally caps the score at 3 and sets `majorReadinessGap` true.
- An unresolved material constraint caps the score at 4 and sets `unresolvedMaterialConstraint` true.
- A preference is not automatically a blocker if Taylor would realistically accept the tradeoff.

Set `aspirational` true only when the role exposes a material, specific, buildable capability Taylor deliberately wants to develop. A low score alone does not make a role aspirational.

## Role archetype

Choose exactly one supported role archetype supplied by the caller. Classify dominant owned work, intended users, deliverable, and operating responsibility—not title or AI keywords.

Key boundaries:

- `enterprise-applications-engineer`: internal business or collaboration application lifecycle, configuration, integrations, controlled change, and governance.
- `applied-ai-engineer`: substantial direct ownership of AI behavior, agents, retrieval/tools, guardrails, evaluation, or production AI workflows.
- `corporate-it-automation`: broad employee identity, endpoints, workplace services, workforce SaaS, and employee support automation.
- `forward-deployed-solutions`: customer architecture, implementation, integration, technical acceptance, or adoption of an existing product.
- `platform-infrastructure-devops`: shared runtime, infrastructure, delivery, reliability, or reusable developer-platform capabilities.
- `product-software-engineer`: conventional product, frontend, backend, desktop, design-engineering, or developer-experience software without dominant AI ownership.
- `technical-support-engineer`: reactive user investigation, reproduction, resolution, escalation, and recurring support feedback.
- `technical-program-manager`: primary coordination of technical programs, dependencies, delivery, risks, and workstreams.
- `technical-product-manager`: primary authority over discovery, roadmap or backlog priority, acceptance, release decisions, and product value.
- `itsm-process-governance`: cross-platform service processes, service ownership, CMDB or knowledge quality, controls, maturity, and measurement.
- `business-systems-enablement`: internal process discovery, readiness, adoption, training, UAT, hypercare, and value realization without dominant engineering ownership.

Other caller-supplied legacy values remain valid only when the evidence clearly fits them. Do not invent a new archetype.

## Output quality

- Keep the summary concise and decision-oriented.
- Strengths and gaps are short evidence-based bullets, at most ten each.
- Do not echo the full posting.
- Do not include secrets, credentials, private note paths, or unsupported personal claims.
- Return only the requested JSON schema.
