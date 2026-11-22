# Lithography Queue & Payback Tool

IE6300, Fall 2026, Northeastern University, Group 7. Created by Anna Noto.

A web tool that estimates how long lots wait at a lithography tool group, and what that delay costs, using data from the SMT2020 benchmark fab (dataset 1, Products 3 and 4, tool group Litho_FE_98: 5 steppers). The wait is calculated with the Sakasegawa G/G/m approximation, the multi-server version of Kingman's equation (it equals Kingman's G/G/1 result when there is one stepper).

Team: Anna (build and demo), Peixuan (model and technical speech), Isabella (costs and marketing speech).

## Status

- Phase 1 (capacity calculations): done. Effective processing time and variability, utilization, and queue wait, running on the Litho_FE_98 data and matching the hand calculation.
- Phase 2 (financial calculations): done. Delay cost from Little's Law (Lq = λ × Wq), payback period, and ROI. The site shows the delay cost of the current state; payback and ROI are calculated in `js/calc.js` and will appear once scenarios are added.
- Next: scenarios (add a stepper, cut the rework rate) and interactive inputs.

## Pages

- **Results**: utilization, wait in queue, time at the tool group, lots waiting, and weekly delay cost, with the wait-vs-utilization chart.
- **Costs**: how the delay cost is calculated and how it changes across the range of waiting costs, plus the cost assumptions and their sources.
- **Data**: the lithography steps, breakdowns and maintenance, and a list of every input with its source.
- **Check against hand calc**: every calculated value next to the hand calculation, plus the self-checks.

## Files

- `index.html`: the page
- `style.css`: layout and colors
- `js/calc.js`: the calculations, one function per formula (Phase 1 capacity, Phase 2 financial)
- `js/app.js`: the inputs (with sources) and the pages; edit inputs here
- `js/tests.js`: self-checks against known answers and the hand calculation (also run with `node js/tests.js`)

## Units

All times are in minutes and all rates per minute, to match the hand calculation. The site converts waits to hours for display. Percentages are decimals (1.7% = 0.017, 87.7% = 0.877).

## Validation

The site reproduces all 19 values in the Litho_FE_98 hand calculation (visit rates, weights, t̄₀, c₀², A, K, tₑ, cₑ², ρ, Wq, and CT) to within 1 part in 10 million, the rounding of the hand calculation. The "Check against hand calc" page shows the comparison, and `js/tests.js` checks it along with cases that have known answers.

## Sources

- Data: Hassoun, M., D. Kopp, A. Kalir, and L. Mönch. 2019. "A New High-Volume/Low-Mix Simulation Testbed for Semiconductor Manufacturing." *Proceedings of the 2019 Winter Simulation Conference*. Dataset files: https://p2schedgen.fernuni-hagen.de/downloads/simulation
- Cost assumptions: Group 7, "Lithography Rework: Cost Assumptions," which lists the sources for the waiting cost, stepper cost, and rework-project cost.
