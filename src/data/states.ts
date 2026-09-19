export type StateTile = { code: string; name: string; col: number; row: number };

export const stateTiles: StateTile[] = [
  { code: "AK", name: "Alaska", col: 0, row: 6 }, { code: "HI", name: "Hawaii", col: 1, row: 6 },
  { code: "WA", name: "Washington", col: 0, row: 0 }, { code: "OR", name: "Oregon", col: 0, row: 1 },
  { code: "CA", name: "California", col: 0, row: 2 }, { code: "ID", name: "Idaho", col: 1, row: 1 },
  { code: "NV", name: "Nevada", col: 1, row: 2 }, { code: "AZ", name: "Arizona", col: 1, row: 3 },
  { code: "MT", name: "Montana", col: 2, row: 0 }, { code: "WY", name: "Wyoming", col: 2, row: 1 },
  { code: "UT", name: "Utah", col: 2, row: 2 }, { code: "CO", name: "Colorado", col: 3, row: 2 },
  { code: "NM", name: "New Mexico", col: 2, row: 3 }, { code: "ND", name: "North Dakota", col: 3, row: 0 },
  { code: "SD", name: "South Dakota", col: 3, row: 1 }, { code: "NE", name: "Nebraska", col: 4, row: 2 },
  { code: "KS", name: "Kansas", col: 4, row: 3 }, { code: "OK", name: "Oklahoma", col: 4, row: 4 },
  { code: "TX", name: "Texas", col: 3, row: 5 }, { code: "MN", name: "Minnesota", col: 4, row: 0 },
  { code: "IA", name: "Iowa", col: 5, row: 2 }, { code: "MO", name: "Missouri", col: 5, row: 3 },
  { code: "AR", name: "Arkansas", col: 5, row: 4 }, { code: "LA", name: "Louisiana", col: 5, row: 5 },
  { code: "WI", name: "Wisconsin", col: 5, row: 0 }, { code: "IL", name: "Illinois", col: 6, row: 2 },
  { code: "MS", name: "Mississippi", col: 6, row: 5 }, { code: "MI", name: "Michigan", col: 6, row: 0 },
  { code: "IN", name: "Indiana", col: 7, row: 2 }, { code: "KY", name: "Kentucky", col: 7, row: 3 },
  { code: "TN", name: "Tennessee", col: 7, row: 4 }, { code: "AL", name: "Alabama", col: 7, row: 5 },
  { code: "OH", name: "Ohio", col: 8, row: 2 }, { code: "WV", name: "West Virginia", col: 8, row: 3 },
  { code: "GA", name: "Georgia", col: 8, row: 5 }, { code: "FL", name: "Florida", col: 9, row: 6 },
  { code: "PA", name: "Pennsylvania", col: 9, row: 1 }, { code: "VA", name: "Virginia", col: 9, row: 3 },
  { code: "NC", name: "North Carolina", col: 9, row: 4 }, { code: "SC", name: "South Carolina", col: 9, row: 5 },
  { code: "NY", name: "New York", col: 10, row: 0 }, { code: "NJ", name: "New Jersey", col: 10, row: 2 },
  { code: "MD", name: "Maryland", col: 10, row: 3 }, { code: "DE", name: "Delaware", col: 11, row: 3 },
  { code: "DC", name: "District of Columbia", col: 10, row: 4 }, { code: "VT", name: "Vermont", col: 11, row: 0 },
  { code: "MA", name: "Massachusetts", col: 12, row: 1 }, { code: "CT", name: "Connecticut", col: 11, row: 2 },
  { code: "RI", name: "Rhode Island", col: 12, row: 2 }, { code: "NH", name: "New Hampshire", col: 12, row: 0 },
  { code: "ME", name: "Maine", col: 13, row: 0 },
];

export function marginColor(value?: number) {
  if (value === undefined) return "var(--map-empty)";
  if (value >= 8) return "#2e63c9";
  if (value > 1) return "#5f8ee7";
  if (value >= -1) return "#8d7b83";
  if (value > -8) return "#d35e67";
  return "#a93643";
}
