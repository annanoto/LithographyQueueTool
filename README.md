# Lithography Queue & Payback Tool

IE6300, Fall 2026, Northeastern University, Group 7. Created by Anna Noto.

Live site: https://annanoto.github.io/LithographyQueueTool/

A web tool that estimates how long lots wait at a lithography tool group, what that wait costs, and whether adding a stepper or cutting the rework rate pays off. It uses data from the SMT2020 benchmark fab (dataset 1, Products 3 and 4, tool group Litho_FE_98: 5 steppers). The wait is calculated with the Sakasegawa G/G/m approximation, the multi-server version of Kingman’s equation (it equals Kingman’s G/G/1 result when there is one stepper).

Team: Anna (build and demo), Peixuan (model and technical speech), Isabella (costs and marketing speech).

## Quick start

```bash
git clone https://github.com/annanoto/LithographyQueueTool.git && cd LithographyQueueTool
node js/tests.js                 # 27 unit tests; exit code 0 means all pass
python3 -m http.server 8000      # then open http://localhost:8000
```

Requires Node.js for the tests and Python 3 for the local server. No install or build step; opening `index.html` directly in a browser also works.

## Status

- **Phase 1, capacity calculations:** done. Effective processing time and variability, utilization, and queue time, running on the Litho_FE_98 data and matching the hand calculation.
- **Phase 2, financial calculations:** done. Holding cost from Little’s Law (WIP in queue Lq = λ × Wq), payback period, and ROI.
- **Module 3, scenarios:** done. No change, add a stepper, and cut the rework rate, side by side.
- **Module 4, interactive inputs:** done. Sliders and cost fields that update every result instantly.
- **Still needed:** yearly operating costs for a 6th stepper and for the rework project (or confirmation that they are $0). Until then, payback is shown "pre-opex."

## Vocabulary

One name per concept, used everywhere on the site:

| Term | Meaning |
|---|---|
| **Baseline** | The SMT2020 data as given, the validated hand calculation |
| **Queue time** (Wq) | Average time a lot waits before processing, in hours |
| **Cycle time** (CT) | Queue time + effective processing time |
| **WIP in queue** (Lq) | Average lots waiting, from Little’s Law |
| **Holding cost rate** | $ per lot-hour of waiting (inventory carrying cost) |
| **Holding cost** | WIP in queue × holding cost rate × 8,760 h, always per year |

## Pages

A status line under the tabs shows whether the inputs are at the **Baseline** or modified (listing each change), with a **Reset to baseline** link.

### Explore
- **Inputs:** sliders for rework rate (0.5%–2%), steppers (1–8), availability (70%–99%), and arrival variability cₐ² (0–3), each with its range at the ends and a tick at the baseline value. Cost fields for the holding cost rate ($/lot-h), an extra stepper ($M), and the rework project ($K).
- **Decision banner:** a Baseline / What-if / Capacity alert badge and one insight, such as how far utilization is above the 75–90% target band.
- **Instrument strip:** utilization, queue time, cycle time, WIP in queue, and holding cost per year.
- **Payback:** payback for each fix from the current inputs; the fix that pays back sooner is tagged.
- **Queue time vs. utilization:** the curve for the current inputs, the 75–90% target band, a gold dot for the inputs and a hollow dot for the baseline.
- **Calculation chain:** each equation from arrival rate to WIP in queue, with live values.

### Scenarios
A two-line conclusion and one comparison table: metrics as rows (rework rate, utilization, queue time, WIP in queue, holding cost per year, savings per year, one-time cost, payback), and **No change**, **Add a stepper**, and **Cut rework** as columns, with the change vs. No change under each value. The column that pays back sooner is tagged; hover a payback to see its numbers. Follows the Explore inputs.

### Costs
Holding cost of the queue, following the Explore inputs: the worked calculation (WIP in queue, holding cost rate, holding cost per year), the sensitivity to the holding cost rate across the sourced range ($1.71–$14.55/lot-h), and the cost assumptions with sources.

### Data
Baseline only: the lithography steps, breakdowns and maintenance, and every input with its value and source.

### Validation
Baseline only, so the comparison stays valid: all 19 hand-calc values next to the site’s values, seven sanity checks against theory, the assumptions and limits, and the 27 unit tests.

## Baseline costs (Isabella)

| Cost | Baseline | Reasoning |
|---|---|---|
| Waiting cost | $2.14 per lot-hour | 25 wafers × $3,000 × 25% ÷ 8,760 h |
| Extra stepper | $34M | Dry ArF, the most verified and relevant cost |
| Rework-reduction project | $75,000 (one-time) | The most supported value found |

Holding cost only: it does not include lost output at a bottleneck, delayed revenue, or yield effects.

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

All times are in minutes and all rates per minute, to match the hand calculation. The site converts queue and cycle time to hours for display. Holding cost is always per year, using 8,760 hours (365 × 24). Percentages are decimals in the code (1.7% = 0.017, 87.7% = 0.877).

## Sources

- Data: Hassoun, M., D. Kopp, A. Kalir, and L. Mönch. 2019. "A New High-Volume/Low-Mix Simulation Testbed for Semiconductor Manufacturing." *Proceedings of the 2019 Winter Simulation Conference*. Dataset files: https://p2schedgen.fernuni-hagen.de/downloads/simulation
- Cost assumptions: Group 7, "Lithography Rework: Cost Assumptions," which lists the sources for the waiting cost, stepper cost, and rework-project cost.
