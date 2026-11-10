# Lithography queue tool

IE6300, Fall 2026, Northeastern University, Group 7, Created by Anna Noto

A web tool that estimates how long lots wait at one lithography stepper, and what that delay costs, using Kingman's equation (G/G/1) and data from the SMT2020 benchmark fab (dataset 1, Product 4). It compares two fixes: adding a stepper or cutting the lithography rework rate.

Team: Anna (build and demo), Peixuan (model and technical speech), Isabella (costs and marketing speech).

## Files

- `index.html` — the page
- `style.css` — layout and colors
- `js/calc.js` — Module 1: the queueing math (one function per formula)
- `js/app.js` — the inputs and the results table; **edit inputs here**
- `js/tests.js` — self-checks against known answers (also run with `node js/tests.js`)

## Units

All times are in hours and all rates per hour. Percentages are decimals (2% = 0.02, 86.2% = 0.862).

## Data source

Hassoun, M., D. Kopp, A. Kalir, and L. Mönch. 2019. "A New High-Volume/Low-Mix Simulation Testbed for Semiconductor Manufacturing." Proceedings of the 2019 Winter Simulation Conference. Dataset files: https://p2schedgen.fernuni-hagen.de/downloads/simulation
