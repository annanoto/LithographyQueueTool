# Lithography Queue & Payback Tool

IE6300, Fall 2026, Northeastern University, Group 7. Created by Anna Noto.

Live site: https://annanoto.github.io/LithographyQueueTool/

A web tool that estimates how long lots wait at a lithography tool group, what that wait costs, and whether adding a stepper or cutting the rework rate pays off. It uses data from the SMT2020 benchmark fab (dataset 1, Products 3 and 4, tool group Litho_FE_98: 5 steppers). The wait is calculated with the Sakasegawa G/G/m approximation, the multi-server version of Kingman’s equation (it equals Kingman’s G/G/1 result when there is one stepper).

Team: Anna (build and demo), Peixuan (model and technical speech), Isabella (costs and marketing speech).

## Status

- **Phase 1, capacity calculations:** done. Effective processing time and variability, utilization, and queue wait, running on the Litho_FE_98 data and matching the hand calculation.
- **Phase 2, financial calculations:** done. Delay cost from Little’s Law (Lq = λ × Wq), payback period, and ROI.
- **Module 3, scenarios:** done. Current state, add a stepper, and cut the rework rate, side by side.
- **Module 4, interactive inputs:** done. Sliders and cost boxes that update every result instantly.
- **Still needed:** yearly operating costs for a 6th stepper and for the rework project (or confirmation that they are $0). Until then, payback is shown "before operating costs."

## Pages

### Explore
The main page, built for trying different values.

- **Sliders** (ranges confirmed by Peixuan): rework rate (0.5%–2%), number of steppers (1–8), availability (70%–99%), and arrival variability cₐ² (0–3). Each starts at the data’s value.
- **Cost boxes:** cost of waiting, cost of an extra stepper, and cost of the rework project, prefilled with Isabella’s baselines.
- **Reset to the data** puts every input back.
- **Results that update instantly:** a one-sentence answer and five headline numbers (utilization, wait in queue, time at stepper, lots waiting, weekly cost of waiting). Once an input changes, each number also shows its "data as given" value.
- **Wait vs. utilization chart:** the gold dot moves with the inputs; a hollow dot marks the data as given.
- **Payback at these settings:** payback for each fix, starting from the current inputs.
- **How the wait is calculated:** the five steps (arrivals, job mix, downtime, utilization, wait) with live values.

### Scenarios
The three scenarios side by side, each showing utilization, wait in queue, lots waiting, yearly cost of the wait, and (for the fixes) yearly savings, cost of the fix, and payback.

- **Current state:** the Explore settings. At the data as given, this is the validated hand calculation.
- **Add a stepper:** one more stepper (5 → 6 at the data as given), rework unchanged.
- **Cut the rework rate:** 072_Litho rework cut to 0.5% (Peixuan’s target, the bottom of the SMT2020 range), steppers unchanged.
- The page follows the Explore inputs, and a note at the top says whether it is using the data as given or changed settings.
- A **"Pays back sooner"** badge goes to whichever fix has the shorter payback. It appears only when both fixes have a payback to compare.
- Each card shows its worked numbers (e.g., Payback = $75,000 ÷ $16,996 per year).

### Costs
The delay cost of the current queue, using the data as given (this page does not follow the sliders).

- **How the delay cost is calculated:** Lq from Little’s Law, cost per lot-hour, and weekly and yearly delay cost, with the numbers shown.
- **Delay cost across the range of waiting costs:** from 28nm to advanced-node wafer values, since no published cost per lot-hour exists.
- **Cost assumptions:** each baseline, its range, and its source.

### Data
The inputs, using the data as given.

- **Lithography steps at this tool group:** one row for each step and lot type, with release interval, wafers, lot time, rework, visit rate, and share.
- **Breakdowns and scheduled maintenance:** how often each happens, how long it lasts, and its share of time down.
- **Data to collect:** every input with its value and source; anything missing is marked in red.

### Check against hand calc
- **Site vs. hand calculation:** all 19 values from Peixuan’s hand calculation next to the site’s values, with the difference and a match column.
- **Self-checks:** 27 tests against cases with known answers, the hand calculation, and the financial formulas.

## Baseline costs (Isabella)

| Cost | Baseline | Reasoning |
|---|---|---|
| Waiting cost | $2.14 per lot-hour | 25 wafers × $3,000 × 25% ÷ 8,760 h |
| Extra stepper | $34M | Dry ArF, the most verified and relevant cost |
| Rework-reduction project | $75,000 (one-time) | The most supported value found |

The cost of waiting is holding cost only. It does not include lost output at a bottleneck, delayed revenue, or yield effects.

## Model notes

- **Rework:** a reworked lot can be reworked again (no limit in SMT2020), so expected visits to Step 65 = 1 ÷ (1 − 0.017). Confirmed by Peixuan.
- **Availability:** A = 1 ÷ (1 + sum of downtime ratios) across the breakdown and the weekly, monthly, and quarterly PMs, as in the hand calculation (87.70%).
- **Availability slider:** changes how often breakdowns and maintenance happen; how long each lasts stays the same.
- **Arrival variability:** cₐ² = 1 is an assumption, not a measurement.
- **Rework has a small effect on the wait:** rework only adds repeat visits to one of the three steps, so cutting it from 1.7% to 0.5% moves the wait from 5.55 to 5.32 hours.

## Files

- `index.html`: the page
- `style.css`: layout and colors (group palette)
- `js/calc.js`: the calculations, one function per formula (capacity, financial, scenarios, slider settings)
- `js/app.js`: the inputs (with sources) and the pages; edit inputs and costs here
- `js/tests.js`: self-checks (also run with `node js/tests.js`)

## Units

All times are in minutes and all rates per minute, to match the hand calculation. The site converts waits to hours for display. Yearly costs use 8,760 hours (365 × 24); weekly costs use 168 hours. Percentages are decimals in the code (1.7% = 0.017, 87.7% = 0.877).

## Sources

- Data: Hassoun, M., D. Kopp, A. Kalir, and L. Mönch. 2019. "A New High-Volume/Low-Mix Simulation Testbed for Semiconductor Manufacturing." *Proceedings of the 2019 Winter Simulation Conference*. Dataset files: https://p2schedgen.fernuni-hagen.de/downloads/simulation
- Cost assumptions: Group 7, "Lithography Rework: Cost Assumptions," which lists the sources for the waiting cost, stepper cost, and rework-project cost.
