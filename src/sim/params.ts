// Parameters of the UK system model. Every value is editable in the app.
// kind: "official" = published by a UK public body; "research" = peer-reviewed or institute estimate;
// "assumption" = a modelling choice made here, stated so it can be challenged and changed.
export type ParamKind = "official" | "research" | "assumption";
export type Param = { id: string; group: string; label: string; value: number; unit: string; kind: ParamKind; source?: string; url?: string; note?: string; min?: number; max?: number; step?: number };

const OBR_MULT = { source: "OBR, Budget June 2010 Economic and fiscal outlook, Annex C (fiscal multipliers used in OBR forecasts)", url: "https://obr.uk/efo/economic-and-fiscal-outlook-june-2010/" };

export const PARAMS: Param[] = [
  // Demand: fiscal multipliers (peak, first-year effect on GDP of a change worth 1% of GDP)
  { id: "m_capital", group: "Fiscal multipliers", label: "Capital spending", value: 1.0, unit: "×", kind: "official", ...OBR_MULT, step: 0.05 },
  { id: "m_resource", group: "Fiscal multipliers", label: "Resource (day-to-day) departmental spending", value: 0.6, unit: "×", kind: "official", ...OBR_MULT, step: 0.05 },
  { id: "m_welfare", group: "Fiscal multipliers", label: "Welfare spending", value: 0.6, unit: "×", kind: "official", ...OBR_MULT, step: 0.05 },
  { id: "m_vat", group: "Fiscal multipliers", label: "VAT", value: 0.35, unit: "×", kind: "official", ...OBR_MULT, step: 0.05 },
  { id: "m_income", group: "Fiscal multipliers", label: "Income tax and NICs", value: 0.3, unit: "×", kind: "official", ...OBR_MULT, step: 0.05 },
  { id: "m_corp", group: "Fiscal multipliers", label: "Corporation tax", value: 0.3, unit: "×", kind: "assumption", note: "Not in the 2010 table; set equal to income tax. Corporation tax may hit investment more slowly but more persistently.", step: 0.05 },
  { id: "m_fuel", group: "Fiscal multipliers", label: "Fuel duty", value: 0.3, unit: "×", kind: "assumption", note: "Set equal to income tax; fuel duty acts on household real income much like it.", step: 0.05 },
  { id: "fade", group: "Fiscal multipliers", label: "Years for demand effect to fade to zero", value: 4, unit: "years", kind: "assumption", note: "OBR assumes the output gap closes over its forecast as monetary policy offsets fiscal shocks; this spreads that fade linearly.", min: 1, max: 10, step: 1 },
  // Supply side
  { id: "inv_potential_5y", group: "Supply side", label: "Potential output gain after 5 years from sustained public investment of 1% of GDP", value: 0.4, unit: "% of GDP", kind: "official", source: "OBR, Economic and fiscal outlook October 2024, box on the long-run effects of higher public investment: about 0.4% after 5 years and 1.4% after 50 years", url: "https://obr.uk/efo/economic-and-fiscal-outlook-october-2024/", step: 0.05 },
  // Automatic stabilisers
  { id: "stabiliser", group: "Automatic stabilisers", label: "Change in borrowing per 1% change in output", value: 0.5, unit: "% of GDP", kind: "official", source: "OBR Working Paper No. 5, Cyclically adjusting the public finances (2014): budget balance moves about 0.5% of GDP per 1% of output gap", url: "https://obr.uk/working-paper-no5-cyclically-adjusting-public-finances/", step: 0.05 },
  // Labour market
  { id: "okun", group: "Labour market", label: "Okun coefficient (unemployment change per 1% output change)", value: 0.4, unit: "pp per %", kind: "research", source: "Ball, Leigh and Loungani (2017), Okun's Law: Fit at 50?, Journal of Money, Credit and Banking: UK estimate about 0.3 to 0.4", url: "https://doi.org/10.1111/jmcb.12420", step: 0.05 },
  { id: "labour_force", group: "Labour market", label: "Labour force", value: 34.6, unit: "million", kind: "official", source: "ONS Labour Force Survey (economically active 16+, approximate, 2026)", url: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest", step: 0.1 },
  // Debt interest
  { id: "marginal_rate", group: "Debt interest", label: "Interest rate on extra borrowing", value: 4.5, unit: "%", kind: "assumption", note: "Roughly the 10-year gilt yield through 2026. Change it to test a cheaper or dearer market.", step: 0.1 },
  { id: "reprice_y1", group: "Debt interest", label: "Share of debt repricing within a year of a rate shock", value: 30, unit: "%", kind: "assumption", note: "Bank Rate-linked liabilities (reserves created by quantitative easing), Treasury bills and maturing gilts. OBR's debt-interest ready reckoner is the reference.", url: "https://obr.uk/forecasts-in-depth/brief-guides-and-explainers/debt-interest/", step: 1 },
  { id: "avg_maturity", group: "Debt interest", label: "Average maturity of the gilt stock", value: 14, unit: "years", kind: "official", source: "UK Debt Management Office, quarterly review: average conventional gilt maturity about 14 years", url: "https://www.dmo.gov.uk/data/gilt-market/", step: 1 },
  // Civil service
  { id: "cs_cost", group: "Civil service", label: "Average cost per civil servant (pay plus pension and NI)", value: 47, unit: "£k", kind: "assumption", note: "Median salary £35,680 (Civil Service Statistics 2025) plus about 30% employer on-costs.", step: 1 },
  { id: "cs_severance", group: "Civil service", label: "One-off exit cost per post cut", value: 0.75, unit: "× salary", kind: "assumption", note: "The Civil Service Compensation Scheme pays one month per year of service, capped at 21 months for compulsory exits. Voluntary schemes vary.", step: 0.05 },
  // NHS
  { id: "nhs_elastic", group: "NHS", label: "Extra elective treatment per 1% real rise in NHS England funding", value: 0.5, unit: "%", kind: "assumption", note: "No official elasticity exists. Much new money goes to pay, emergency care and inflation, so less than 1:1 is assumed.", step: 0.05 },
  { id: "nhs_demand", group: "NHS", label: "Growth in referrals (clock starts) per year", value: 2.5, unit: "%", kind: "assumption", note: "Ageing and morbidity. Set it to 0 to see a no-growth world.", step: 0.1 },
  { id: "nhs_supply_base", group: "NHS", label: "Baseline growth in completed treatments per year", value: 2.5, unit: "%", kind: "assumption", note: "Set equal to referral growth by default, so the baseline list stays roughly flat, as it did from Sept 2025 to Sept 2026.", step: 0.1 },
  // Councils
  { id: "la_gap", group: "Councils", label: "Social care demand growth above funded growth", value: 1.0, unit: "pp per year", kind: "assumption", note: "Adult and children's social care demand growing faster than core spending power. Applied to £44bn of social care spending.", step: 0.1 },
  { id: "la_dsg_growth", group: "Councils", label: "Growth in high-needs (SEND) deficits", value: 2.0, unit: "£bn per year", kind: "assumption", note: "The DSG deficit was £6.7bn at 31 March 2026 (MHCLG outturn). The statutory override that keeps it off council balance sheets is due to end in March 2028.", step: 0.1 },
  // Schools
  { id: "schools_core", group: "Schools", label: "Core schools budget (England)", value: 65.3, unit: "£bn", kind: "official", source: "DfE, core schools budget 2025-26", url: "https://www.gov.uk/government/publications/schools-funding-2025-to-2026", step: 0.1 },
];

export type ParamValues = Record<string, number>;
export const defaultParams = (): ParamValues => Object.fromEntries(PARAMS.map((p) => [p.id, p.value]));
