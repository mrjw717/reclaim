import type { ReactNode } from "react";
import { DEFAULT_BRAND_COLOR } from "../theme-palette";

type Form = "organization" | "found" | "lost";
type Scenario =
  | "organization"
  | "invalid"
  | "found"
  | "matching"
  | "high-value"
  | "secure-storage"
  | "duplicate-candidate"
  | "retention-eligible"
  | "lost"
  | "competing-claim";
type Values = Record<string, string | number | boolean | null>;

const ordinaryFound: Values = {
  name: "Blue insulated water bottle",
  categoryId: "drinkware",
  description: "Blue stainless-steel bottle with a small star sticker on the base.",
  color: "Blue",
  brand: "HydroPeak",
  foundLocation: "East Gymnasium",
  finderName: "Taylor Reed",
  finderContact: "taylor@example.test",
  staffNotes: "Found near the west entrance.",
};
const matchingLost: Values = {
  name: "Blue stainless-steel water bottle",
  categoryId: "drinkware",
  description: "Blue bottle with a small star sticker on the base.",
  color: "Blue",
  brand: "HydroPeak",
  lastLocation: "East Gymnasium",
  claimantName: "Taylor Reed",
  contact: "taylor@example.test",
  notes: "Matching found item is ready for staff review.",
};
const todayLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
const daysAgoLocal = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const options: Record<Form, { id: Scenario; label: string }[]> = {
  organization: [
    { id: "organization", label: "Organization setup" },
    { id: "invalid", label: "Invalid required field" },
  ],
  found: [
    { id: "found", label: "Ordinary found item" },
    { id: "matching", label: "Possible match for lost report" },
    { id: "high-value", label: "High-value item" },
    { id: "secure-storage", label: "Secure-storage item" },
    { id: "duplicate-candidate", label: "Duplicate candidate" },
    { id: "retention-eligible", label: "Retention-eligible item" },
    { id: "invalid", label: "Invalid required field" },
  ],
  lost: [
    { id: "lost", label: "Ordinary lost report" },
    { id: "matching", label: "Matches a found item" },
    { id: "competing-claim", label: "Competing claimant" },
    { id: "invalid", label: "Invalid required field" },
  ],
};

function dataFor(form: Form, scenario: Scenario): Values {
  if (scenario === "invalid") return { name: "" };
  if (form === "organization")
    return {
      name: "Northside Community Center",
      organizationType: "Community center",
      phone: "(555) 010-2040",
      email: "hello@example.test",
      primaryColor: DEFAULT_BRAND_COLOR,
    };
  if (form === "lost") {
    if (scenario === "competing-claim")
      return {
        ...matchingLost,
        claimantName: "Morgan Patel",
        contact: "morgan@example.test",
        notes: "Second claimant reports the same bottle. Compare details before deciding.",
      };
    return {
      ...matchingLost,
      ...(scenario === "lost"
        ? {
            name: "Missing black umbrella",
            categoryId: "other",
            description: "Compact umbrella with a curved wooden handle.",
            color: "Black",
            brand: "",
            lastLocation: "Northside lobby",
            claimantName: "Jamie Rivera",
            contact: "jamie@example.test",
          }
        : {}),
    };
  }
  if (scenario === "high-value")
    return {
      ...ordinaryFound,
      name: "Gold bracelet with engraved initials",
      categoryId: "jewelry-watches",
      description:
        "Gold bracelet with an engraved clasp. Staff should follow the high-value handling procedure.",
      color: "Gold",
      brand: "",
      foundLocation: "Main auditorium",
      staffNotes:
        "High-value property. Keep in secure custody and require documented verification.",
    };
  if (scenario === "secure-storage")
    return {
      ...ordinaryFound,
      name: "Smartphone in protective case",
      categoryId: "phones-mobile",
      description: "Black smartphone in a protective case. Locked drawer placement required.",
      color: "Black",
      brand: "Example",
      staffNotes: "Use a secure storage location before saving.",
    };
  if (scenario === "duplicate-candidate")
    return {
      ...ordinaryFound,
      staffNotes:
        "Possible duplicate of an existing item record. Compare before creating another record.",
    };
  if (scenario === "retention-eligible")
    return {
      ...ordinaryFound,
      name: "Unclaimed blue water bottle",
      foundAt: daysAgoLocal(45),
      staffNotes:
        "Old sample record for retention review. Confirm the deadline before disposition.",
    };
  if (scenario === "matching")
    return {
      ...ordinaryFound,
      name: "Blue stainless-steel water bottle",
      description: "Blue bottle with a small star sticker on the base.",
      foundAt: todayLocal(),
    };
  return { ...ordinaryFound, foundAt: todayLocal() };
}

export default function DevAutofill({
  scenario,
  onFill,
}: {
  scenario: Form;
  onFill: (values: Values, selectedScenario: Scenario) => void;
}): ReactNode {
  const defaultScenario: Scenario = scenario;
  return (
    <div className="dev-autofill">
      <span>DEVELOPMENT ONLY</span>
      <label className="dev-autofill-picker">
        <span>Scenario</span>
        <select
          aria-label="Autofill scenario"
          defaultValue={defaultScenario}
          onChange={(event) => {
            (event.currentTarget as HTMLSelectElement).dataset.scenario = event.currentTarget.value;
          }}
        >
          {options[scenario].map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button button-secondary button-small"
        onClick={(event) => {
          const select = event.currentTarget.parentElement?.querySelector<HTMLSelectElement>(
            'select[aria-label="Autofill scenario"]',
          );
          const chosen = (select?.value || defaultScenario) as Scenario;
          onFill(dataFor(scenario, chosen), chosen);
        }}
      >
        Fill form
      </button>
    </div>
  );
}
