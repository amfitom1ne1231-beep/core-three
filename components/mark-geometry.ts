// Сгенерировано brand/build-mark.py — правки вносить там.

export type MarkFacet = { facet: string; opacity: number; d: string };
export type MarkArm = { arm: string; core: string; facets: MarkFacet[] };

export const MARK_ARMS: MarkArm[] = [
  {
    arm: 'honesty',
    core: 'Честность',
    facets: [
      { facet: 'cap', opacity: 0.82, d: 'M37.36 13.00 L50.00 5.70 L62.64 13.00 L50.00 20.30 Z' },
      { facet: 'left', opacity: 0.55, d: 'M49.83 59.44 L49.83 20.58 L37.18 13.28 L37.18 25.78 L33.47 25.78 L22.99 43.94 Z' },
      { facet: 'right', opacity: 1.0, d: 'M50.17 59.44 L77.01 43.94 L66.53 25.78 L62.82 25.78 L62.82 13.28 L50.17 20.58 Z' },
    ]
  },
  {
    arm: 'speed',
    core: 'Скорость',
    facets: [
      { facet: 'cap', opacity: 0.82, d: 'M96.90 72.34 L96.90 86.94 L84.26 94.24 L84.26 79.64 Z' },
      { facet: 'left', opacity: 0.55, d: 'M50.46 59.92 L84.11 79.35 L96.75 72.05 L85.92 65.80 L87.78 62.59 L77.30 44.43 Z' },
      { facet: 'right', opacity: 1.0, d: 'M50.28 60.22 L50.28 91.22 L71.25 91.21 L73.11 88.00 L83.93 94.25 L83.94 79.65 Z' },
    ]
  },
  {
    arm: 'craft',
    core: 'Профессионализм',
    facets: [
      { facet: 'cap', opacity: 0.82, d: 'M15.74 94.24 L3.10 86.94 L3.10 72.34 L15.74 79.64 Z' },
      { facet: 'left', opacity: 0.55, d: 'M49.72 60.22 L16.06 79.65 L16.07 94.25 L26.89 88.00 L28.75 91.21 L49.72 91.22 Z' },
      { facet: 'right', opacity: 1.0, d: 'M49.54 59.92 L22.70 44.43 L12.22 62.59 L14.08 65.80 L3.25 72.05 L15.89 79.35 Z' },
    ]
  },
];

/** Центр трёхкратной симметрии в системе viewBox — вокруг него вращаются лучи. */
export const MARK_CENTER = { x: 50, y: 59.44 };
