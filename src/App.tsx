import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  useRef,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { confirm as confirmDialog, message as messageDialog } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock3,
  Backpack,
  BookOpen,
  CupSoda,
  FileSearch,
  Filter,
  Footprints,
  Gamepad2,
  Glasses,
  Headphones,
  IdCard,
  ImageOff,
  KeyRound,
  Laptop,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Trophy,
  UserRound,
  Wallet,
  Watch,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  emptyStats,
  type Bootstrap,
  type Category,
  type ConfirmedClaim,
  type DashboardStats,
  type FoundInput,
  type FoundItem,
  type LostInput,
  type LostReport,
  type MatchCandidate,
  type Organization,
  type OrganizationLocation,
  type RetentionRecord,
  type SetupInput,
  type StorageLocation,
} from "./api";
import packageJson from "../package.json";
import { BrandIcon, BrandLockup } from "./brand";
import { BRAND_PALETTE, DEFAULT_BRAND_COLOR } from "./theme-palette";
import "./theme.css";
import "./App.css";
import DevAutofill from "./dev/autofill";

type View = "dashboard" | "inventory" | "lost" | "storage" | "retention" | "settings";
type Modal = "found" | "edit" | "lost" | "category" | "storage" | "return" | "disposition" | null;
const iconMap: Record<string, LucideIcon> = {
  Smartphone,
  Laptop,
  KeyRound,
  Wallet,
  Shirt,
  Watch,
  Package,
  BookOpen,
  Headphones,
  Glasses,
  Backpack,
  Footprints,
  CupSoda,
  Trophy,
  Gamepad2,
  IdCard,
};
/** Every seeded category icon, with the friendly label shown in the picker. */
const ICON_CHOICES: { value: string; label: string }[] = [
  { value: "Smartphone", label: "Phones & mobile" },
  { value: "Laptop", label: "Computers & tablets" },
  { value: "KeyRound", label: "Keys & keychains" },
  { value: "Wallet", label: "Wallets & purses" },
  { value: "Shirt", label: "Clothing" },
  { value: "Footprints", label: "Shoes & footwear" },
  { value: "Backpack", label: "Bags & backpacks" },
  { value: "Watch", label: "Watches & jewelry" },
  { value: "Glasses", label: "Glasses & eyewear" },
  { value: "CupSoda", label: "Bottles & drinkware" },
  { value: "BookOpen", label: "Books & school" },
  { value: "Trophy", label: "Sporting equipment" },
  { value: "Gamepad2", label: "Toys & games" },
  { value: "Headphones", label: "Headphones & audio" },
  { value: "IdCard", label: "IDs & documents" },
  { value: "Package", label: "Other / uncategorized" },
];
/** Greeting by hour of day, exported pure so tests can pin it. */
export const timeGreeting = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
const VIEW_TITLES: Record<View, string> = {
  dashboard: "Overview",
  inventory: "Found items",
  lost: "Lost reports",
  storage: "Storage",
  retention: "Retention review",
  settings: "Settings",
};
const VIEW_COPY: Record<View, { heading: string; tagline: string }> = {
  // The dashboard heading is the time-of-day greeting followed by the name.
  dashboard: { heading: "", tagline: "Here’s what’s happening across your lost & found." },
  inventory: {
    heading: "Found items",
    tagline: "Search, organize, and return items in your care.",
  },
  lost: { heading: "Lost reports", tagline: "Reports from people looking for their belongings." },
  storage: {
    heading: "Storage locations",
    tagline: "Keep every item easy to find, from building to shelf.",
  },
  retention: {
    heading: "Retention review",
    tagline: "Review unclaimed items against your organization’s retention policy.",
  },
  settings: {
    heading: "Settings",
    tagline: "Set up Reclaim to fit the way your organization works.",
  },
};
const MODAL_COPY: Record<
  Exclude<Modal, null>,
  { eyebrow: string; heading: string; blurb: string }
> = {
  found: {
    eyebrow: "NEW INVENTORY RECORD",
    heading: "Register a found item",
    blurb: "A few details now make this item easy to find later.",
  },
  edit: {
    eyebrow: "EDIT INVENTORY RECORD",
    heading: "Edit item details",
    blurb: "Changes are recorded in this item’s custody history.",
  },
  lost: {
    eyebrow: "NEW CLAIM REPORT",
    heading: "Create a lost report",
    blurb: "Capture what the person remembers about their item.",
  },
  category: {
    eyebrow: "WORKSPACE SETTINGS",
    heading: "Add a category",
    blurb: "Keep your workspace organized around how your team operates.",
  },
  storage: {
    eyebrow: "WORKSPACE SETTINGS",
    heading: "Add a storage location",
    blurb: "Keep your workspace organized around how your team operates.",
  },
  return: {
    eyebrow: "COMPLETE A RETURN",
    heading: "Return this item",
    blurb: "Record the recipient and how staff confirmed ownership.",
  },
  disposition: {
    eyebrow: "RETENTION REVIEW",
    heading: "Record disposition",
    blurb: "This action closes the custody record and is retained in its history.",
  },
};
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const dateLabel = (value: string) => {
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dayOnly
    ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]), 12)
    : new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const initials = (name?: string | null) =>
  (name || "Reclaim")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const readFileDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image."));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
const UI_SCALES = [1, 1.15, 1.3] as const;
/** Default interface scale: the middle option, chosen for on-screen readability. */
const DEFAULT_UI_SCALE = UI_SCALES[1];
const UI_SCALE_KEY = "reclaim.interfaceScale";
/** How long a confirmation toast stays on screen. */
const TOAST_MS = 3600;
/** Keystroke quiet period before a search query is committed to the database. */
const SEARCH_DEBOUNCE_MS = 250;
type SettingsSection =
  "organization" | "categories" | "storage" | "policies" | "data" | "appearance";
/** The search hint shows the accelerator the platform actually responds to. */
const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const INVENTORY_VIEW_KEY = "reclaim.inventoryView";
type InventoryView = "list" | "gallery";
function readInventoryView(): InventoryView {
  try {
    return window.localStorage.getItem(INVENTORY_VIEW_KEY) === "gallery" ? "gallery" : "list";
  } catch {
    return "list";
  }
}
/** Marquee pace in pixels per second: slow enough that photographs stay recognizable. */
const GALLERY_PACE_PX_PER_SECOND = 25;
const GALLERY_MIN_LOOP_SECONDS = 24;
type GalleryMotion = "stationary" | "looping";
/**
 * Pure decision for the recent-items gallery: loop only when a single track
 * copy overflows the viewport, and never animate for reduced-motion users
 * (their viewport scrolls natively instead). Exported for regression tests
 * because jsdom cannot reproduce real layout.
 */
export function resolveGalleryMotion(
  copyWidth: number,
  viewportWidth: number,
  reducedMotion: boolean,
): GalleryMotion {
  if (reducedMotion) return "stationary";
  return copyWidth > viewportWidth + 4 ? "looping" : "stationary";
}
/** One bulk fetch of first managed photographs for the given items; missing or unreadable photos map to null. */
function useItemPhotoPreviews(items: { id: string }[]) {
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const key = items.map((item) => item.id).join("|");
  useEffect(() => {
    let live = true;
    if (!key) {
      setPhotos({});
      return;
    }
    api
      .itemPhotoPreviews(key.split("|"))
      .then((rows) => {
        if (!live) return;
        const next: Record<string, string | null> = {};
        for (const id of key.split("|")) next[id] = null;
        if (Array.isArray(rows))
          for (const row of rows)
            if (row && typeof row.itemId === "string") next[row.itemId] = row.dataUrl ?? null;
        setPhotos(next);
      })
      .catch(() => {
        // A failed bulk fetch must not render blank tiles: map every item to
        // null so the same "No photo" affordance appears as for missing photos.
        if (!live) return;
        const next: Record<string, string | null> = {};
        for (const id of key.split("|")) next[id] = null;
        setPhotos(next);
      });
    return () => {
      live = false;
    };
  }, [key]);
  return photos;
}
/**
 * Shared dialog focus trap. On mount it focuses the first focusable control,
 * cycles Tab (and Shift+Tab) within the dialog, invokes onClose on Escape,
 * and restores focus to the opener on unmount. While `suspended` (another
 * dialog, such as a modal above the drawer, owns the keyboard) all handling
 * is paused. For labelled dialogs, pass labelId: the first h2 receives it for
 * aria-labelledby and the original id is restored on close.
 */
function useFocusTrap<T extends HTMLElement>({
  onClose,
  suspended = false,
  labelId,
}: {
  onClose: () => void;
  suspended?: boolean;
  labelId?: string;
}) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  // Capture the opener during render: commit-time autoFocus inside the dialog
  // would otherwise run before this effect and corrupt an effect-time snapshot.
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) openerRef.current = document.activeElement as HTMLElement | null;
  const labelRef = useRef<{ element: HTMLElement | null; previous: string | null }>({
    element: null,
    previous: null,
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (labelId) {
      const heading = dialog.querySelector<HTMLElement>("h2");
      labelRef.current = { element: heading, previous: heading?.id ?? null };
      if (heading) heading.id = labelId;
    }
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
        ),
      ).filter((element) => element.getAttribute("tabindex") !== "-1");
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (suspendedRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusables();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const labelled = labelRef.current.element;
      if (labelled) {
        if (labelRef.current.previous) labelled.id = labelRef.current.previous;
        else labelled.removeAttribute("id");
      }
      openerRef.current?.focus();
    };
  }, [labelId]);
  return ref;
}
function ItemPhoto({ dataUrl }: { dataUrl: string | null | undefined }) {
  return (
    <span className={`item-photo ${dataUrl === null ? "empty" : ""}`} aria-hidden="true">
      {dataUrl ? (
        <img src={dataUrl} alt="" loading="lazy" decoding="async" />
      ) : dataUrl === null ? (
        <>
          <ImageOff size={17} />
          {/* Visual-only placeholder: the text lives in CSS content so it is
              not a DOM text node inside labeled photo cards (the tile is
              aria-hidden and the card's accessible name already describes it). */}
          <small />
        </>
      ) : null}
    </span>
  );
}
type SelectOption = { value: string; label: string; icon?: LucideIcon; disabled?: boolean }; /**
 * Styled, accessible replacement for native <select>: a select-only combobox
 * per the WAI-APG pattern. Trigger keeps focus while open (aria-activedescendant
 * tracks the highlighted option); arrows/Home/End/typeahead move, Enter/Space
 * commit, Escape closes without changing the value, Tab or outside pointer
 * dismisses.
 */
function SelectMenu({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });
  const openedAt = useRef(0);
  const listId = useId();
  const enabled = options
    .map((opt, index) => (opt.disabled ? -1 : index))
    .filter((index) => index >= 0);
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? placeholder;

  const openList = () => {
    setOpen(true);
    openedAt.current = Date.now();
    const current = options.findIndex((opt) => opt.value === value);
    setActiveIndex(current >= 0 ? current : (enabled[0] ?? 0));
    // Viewport-fixed positioning: the popup can never be clipped by drawer,
    // modal, or panel edges, and never expands an ancestor scroll container.
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect && typeof window !== "undefined" && window.innerHeight > 0) {
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < Math.min(200, spaceAbove) && spaceAbove > 140;
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8),
      );
      const maxHeight = Math.max(140, Math.min(280, (openUp ? spaceAbove : spaceBelow) - 4));
      setPopupStyle(
        openUp
          ? {
              position: "fixed",
              left,
              bottom: window.innerHeight - rect.top + 4,
              width: "max-content",
              minWidth: rect.width,
              maxWidth: window.innerWidth - left - 8,
              maxHeight,
            }
          : {
              position: "fixed",
              left,
              top: rect.bottom + 4,
              width: "max-content",
              minWidth: rect.width,
              maxWidth: window.innerWidth - left - 8,
              maxHeight,
            },
      );
    } else setPopupStyle(null);
  };
  const closeList = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const commit = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    if (opt.value !== value) onChange(opt.value);
    closeList();
  };
  const move = (delta: number) => {
    if (!enabled.length) return;
    const position = enabled.indexOf(activeIndex);
    const next = position >= 0 ? (position + delta + enabled.length) % enabled.length : 0;
    setActiveIndex(enabled[next < 0 ? 0 : next] ?? enabled[0]);
  };
  const typeaheadMatch = (character: string) => {
    const now = Date.now();
    const state = typeahead.current;
    state.buffer = now - state.at < 600 ? state.buffer + character : character;
    state.at = now;
    const query = state.buffer.toLowerCase();
    const start = activeIndex >= 0 ? (activeIndex + 1) % options.length : 0;
    for (let step = 0; step < options.length; step += 1) {
      const index = (start + step) % options.length;
      const opt = options[index];
      if (!opt.disabled && opt.label.toLowerCase().startsWith(query)) {
        setActiveIndex(index);
        return;
      }
    }
  };
  useEffect(() => {
    if (open && activeIndex >= 0)
      (listRef.current?.children[activeIndex] as HTMLElement | undefined)?.scrollIntoView?.({
        block: "nearest",
      });
  }, [open, activeIndex]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    // Scrolling any ancestor (or the window resizing) while the popup is open
    // would detach a fixed popup from its trigger, so dismiss instead — but a
    // programmatic focus/layout scroll right after opening (e.g. the drawer
    // focusing its close button) must not dismiss it.
    const onScroll = (event: Event) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (Date.now() - openedAt.current < 300) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home" && enabled.length) {
      event.preventDefault();
      setActiveIndex(enabled[0]);
    } else if (event.key === "End" && enabled.length) {
      event.preventDefault();
      setActiveIndex(enabled[enabled.length - 1]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
      typeaheadMatch(event.key);
  };
  return (
    <div className="select-menu" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        aria-label={ariaLabel}
        className={open ? "select-trigger open" : "select-trigger"}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span
          className={`select-value${options.some((opt) => opt.value === value) ? "" : " placeholder"}`}
        >
          {selectedLabel}
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="select-popup"
          style={popupStyle ?? undefined}
        >
          {options.map((opt, index) => {
            const OptionIcon = opt.icon;
            return (
              <li
                key={opt.value}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled || undefined}
                className={`select-option${index === activeIndex ? " active" : ""}${opt.value === value ? " selected" : ""}`}
                onClick={() => commit(index)}
                onMouseEnter={() => {
                  if (!opt.disabled) setActiveIndex(index);
                }}
              >
                {OptionIcon && <OptionIcon size={14} aria-hidden="true" />}
                <span>{opt.label}</span>
                {opt.value === value && <Check size={14} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
/** Row thumbnail: stored photo when available, category icon tile otherwise. */
function ItemThumb({
  photo,
  categoryId,
  tone = "mint",
}: {
  photo: string | null | undefined;
  categoryId: string;
  tone?: string;
}) {
  return photo ? (
    <img className="item-thumb" src={photo} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className={`item-icon ${tone}`}>
      <ItemIcon categoryId={categoryId} />
    </span>
  );
}
/**
 * Space-filling gallery of recent item photographs. Renders the fetched
 * records once per copy at most; looping duplicates only DOM nodes of the
 * same data (never refetches) so the -50% translation stays seamless.
 */
function RecentGallery({
  items,
  onSelect,
}: {
  items: FoundItem[];
  onSelect: (item: FoundItem) => void;
}) {
  const photos = useItemPhotoPreviews(items);
  const viewportRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ motion: GalleryMotion; durationSeconds: number }>({
    motion: "stationary",
    durationSeconds: GALLERY_MIN_LOOP_SECONDS,
  });
  const reducedMotion = useRef(false);
  useEffect(() => {
    const query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const measure = () => {
      const viewport = viewportRef.current;
      const copy = copyRef.current;
      if (!viewport || !copy) return;
      const copyWidth = copy.offsetWidth;
      const durationSeconds = Math.max(
        GALLERY_MIN_LOOP_SECONDS,
        Math.round(copyWidth / GALLERY_PACE_PX_PER_SECOND),
      );
      setState((current) =>
        current.motion ===
          resolveGalleryMotion(copyWidth, viewport.clientWidth, reducedMotion.current) &&
        current.durationSeconds === durationSeconds
          ? current
          : {
              motion: resolveGalleryMotion(copyWidth, viewport.clientWidth, reducedMotion.current),
              durationSeconds,
            },
      );
    };
    const syncPreference = () => {
      reducedMotion.current = Boolean(query?.matches);
      measure();
    };
    syncPreference();
    query?.addEventListener?.("change", syncPreference);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (viewportRef.current && observer) observer.observe(viewportRef.current);
    window.addEventListener("resize", measure);
    return () => {
      query?.removeEventListener?.("change", syncPreference);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);
  const loop = state.motion === "looping";
  const cards = (echo: boolean) =>
    items.map((item) => (
      <button
        type="button"
        key={`${echo ? "echo" : "card"}-${item.id}`}
        className="gallery-card"
        onClick={() => onSelect(item)}
        tabIndex={echo ? -1 : undefined}
        // The visible card text is the item name, category, and status badge,
        // so the accessible name must contain that same text (WCAG 2.5.3).
        aria-label={`Open details for ${item.name}, ${item.categoryName} — ${statusLabel(item.status)}`}
      >
        <ItemPhoto dataUrl={photos[item.id]} />
        <span className="gallery-copy">
          <strong>{item.name}</strong>{" "}
          <span className="gallery-meta">
            <small>{item.categoryName}</small> <StatusBadge status={item.status} />
          </span>
        </span>
      </button>
    ));
  return (
    <div className="gallery-viewport" ref={viewportRef} data-gallery-state={state.motion}>
      <div
        className={`gallery-track${loop ? " is-looping" : ""}`}
        style={
          loop
            ? ({ "--gallery-loop-duration": `${state.durationSeconds}s` } as React.CSSProperties)
            : undefined
        }
      >
        <div className="gallery-group" ref={copyRef}>
          {cards(false)}
        </div>
        {loop && (
          <div className="gallery-group" aria-hidden="true">
            {cards(true)}
          </div>
        )}
      </div>
    </div>
  );
}

function readUiScale(): number {
  try {
    const stored = Number(window.localStorage.getItem(UI_SCALE_KEY));
    return UI_SCALES.includes(stored as (typeof UI_SCALES)[number]) ? stored : DEFAULT_UI_SCALE;
  } catch {
    return DEFAULT_UI_SCALE;
  }
}
function UiSizeControl({ scale, onChange }: { scale: number; onChange: (scale: number) => void }) {
  const index = UI_SCALES.indexOf(scale as (typeof UI_SCALES)[number]);
  return (
    <div className="ui-size-control" role="group" aria-label="Text and interface size">
      <button
        type="button"
        onClick={() => onChange(UI_SCALES[Math.max(0, index - 1)])}
        disabled={index === 0}
        aria-label="Decrease text and interface size"
        title="Decrease text and interface size"
      >
        <span className="ui-size-small" aria-hidden="true">
          A
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange(UI_SCALES[Math.min(UI_SCALES.length - 1, index + 1)])}
        disabled={index === UI_SCALES.length - 1}
        aria-label="Increase text and interface size"
        title="Increase text and interface size"
      >
        <span className="ui-size-large" aria-hidden="true">
          A
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        Text and interface size {index === 0 ? "small" : index === 1 ? "standard" : "large"}
      </span>
    </div>
  );
}

type ThemeChoice = [Organization["theme"], string, string?];
/** Shared roving-tabindex arrow-key handling for radio-style groups: arrows move focus and selection, wrapping at the ends. */
function rovingTabindexKeyDown(
  event: ReactKeyboardEvent<HTMLDivElement>,
  onSelect: (value: string) => void,
) {
  const direction =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  if (!direction) return;
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  );
  const currentIndex = radios.indexOf(event.target as HTMLButtonElement);
  if (currentIndex < 0 || radios.length < 2) return;
  event.preventDefault();
  const next = radios[(currentIndex + direction + radios.length) % radios.length];
  next.focus();
  onSelect(next.dataset.value ?? "");
}
function ThemeRadioGroup({
  value,
  onChange,
  choices,
  label,
  className = "",
}: {
  value: Organization["theme"];
  onChange: (value: Organization["theme"]) => void;
  choices: ThemeChoice[];
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`theme-options ${className}`}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) =>
        rovingTabindexKeyDown(event, (theme) => onChange(theme as Organization["theme"]))
      }
    >
      {choices.map(([choice, title, description]) => (
        <button
          type="button"
          key={choice}
          data-value={choice}
          role="radio"
          aria-checked={value === choice}
          tabIndex={value === choice ? 0 : -1}
          className={`theme-option ${value === choice ? "selected" : ""}`}
          onClick={() => onChange(choice)}
        >
          <span className={`theme-swatch ${choice}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>{title}</strong>
            {description && <small>{description}</small>}
          </span>
          <span className="radio-dot" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function App() {
  const [uiScale, setUiScale] = useState(readUiScale);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [modal, setModal] = useState<Modal>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingStorage, setEditingStorage] = useState<StorageLocation | null>(null);
  const [selectedItem, setSelectedItem] = useState<FoundItem | null>(null);
  const [items, setItems] = useState<FoundItem[]>([]);
  const [lostReports, setLostReports] = useState<LostReport[]>([]);
  const [preselectedClaim, setPreselectedClaim] = useState<ConfirmedClaim | null>(null);
  const [lostTotal, setLostTotal] = useState(0);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [retentionRecords, setRetentionRecords] = useState<RetentionRecord[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [storageFilter, setStorageFilter] = useState("all");
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryView, setInventoryView] = useState<InventoryView>(readInventoryView);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orgDirty, setOrgDirty] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("organization");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchFocusPending = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const fresh = await api.bootstrap();
      setData(fresh);
      setStats(fresh.stats);
      setError("");
      if (fresh.organization) {
        // Independent queries run concurrently so first paint waits once, not three times.
        const [page, lost, retention] = await Promise.all([
          api.listFound("", null, null, "all", 1, 12),
          api.listLost("", "open"),
          api.retentionQueue(),
        ]);
        setItems(page.items);
        setInventoryTotal(page.total);
        setLostReports(lost.reports);
        setLostTotal(lost.total);
        setRetentionRecords(retention);
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), TOAST_MS);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    try {
      window.localStorage.setItem(UI_SCALE_KEY, String(uiScale));
    } catch {
      /* Preference still applies for this session. */
    }
  }, [uiScale]);
  useEffect(() => {
    try {
      window.localStorage.setItem(INVENTORY_VIEW_KEY, inventoryView);
    } catch {
      /* Preference still applies for this session. */
    }
  }, [inventoryView]);
  // Search commits 250ms after the last keystroke so typing does not fire a
  // SQLite query per character; navigation and Clear filters commit at once.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const result = await api.listFound(
        search,
        categoryFilter === "all" ? null : categoryFilter,
        storageFilter === "all" ? null : storageFilter,
        status,
        inventoryPage,
        10,
        dateFrom,
        dateTo,
      );
      setItems(result.items);
      setInventoryTotal(result.total);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setInventoryLoading(false);
    }
  }, [search, categoryFilter, storageFilter, status, inventoryPage, dateFrom, dateTo]);
  const loadLost = useCallback(async () => {
    try {
      const result = await api.listLost(search, status);
      setLostReports(result.reports);
      setLostTotal(result.total);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, [search, status]);
  useEffect(() => {
    if (view === "inventory") void loadInventory();
    if (view === "lost") void loadLost();
  }, [view, loadInventory, loadLost]);

  /** Navigation that never leaks inventory filters between views and warns before discarding unsaved organization edits. */
  const switchView = useCallback(
    async (next: View): Promise<boolean> => {
      if (
        view === "settings" &&
        settingsSection === "organization" &&
        next !== "settings" &&
        orgDirty
      ) {
        const discard = await confirmDialog(
          "You have unsaved organization changes. Leave without saving them?",
          { title: "Unsaved changes", kind: "warning" },
        );
        if (!discard) return false;
        setOrgDirty(false);
      }
      setView(next);
      setQuery("");
      setSearch("");
      setStatus("all");
      return true;
    },
    [view, settingsSection, orgDirty],
  );
  const openSettings = useCallback(() => {
    // Choose the landing section synchronously: deferring it behind the
    // switchView promise lets a later section change be silently reverted.
    if (view !== "settings") setSettingsSection("organization");
    void switchView("settings");
  }, [switchView, view]);
  const switchSettingsSection = useCallback(
    async (next: SettingsSection) => {
      if (settingsSection === "organization" && next !== "organization" && orgDirty) {
        const discard = await confirmDialog(
          "You have unsaved organization changes. Leave without saving them?",
          { title: "Unsaved changes", kind: "warning" },
        );
        if (!discard) return;
        setOrgDirty(false);
      }
      setSettingsSection(next);
    },
    [settingsSection, orgDirty],
  );

  // Ctrl/Cmd+K focuses the inventory search from anywhere; on other views it
  // navigates there first and focuses once the search field exists.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "k")
        return;
      event.preventDefault();
      if (view === "inventory") {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else {
        searchFocusPending.current = true;
        void switchView("inventory");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  useEffect(() => {
    if (view === "inventory" && searchFocusPending.current) {
      searchFocusPending.current = false;
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [view]);

  const organization = data?.organization ?? null;
  const organizationId = organization?.id ?? null;
  useEffect(() => {
    if (!organizationId) return;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [organizationId]);
  useEffect(() => {
    document.title = organization
      ? `${VIEW_TITLES[view]} · Reclaim`
      : data
        ? "Workspace setup · Reclaim"
        : "Reclaim";
  }, [view, organization, data]);
  const heading =
    view === "dashboard" ? timeGreeting(new Date().getHours()) : VIEW_COPY[view].heading;
  const subtitle = VIEW_COPY[view].tagline;

  const openFound = () => {
    setSelectedItem(null);
    setModal("found");
  };
  const finishMutation = async (message: string) => {
    setToast(message);
    setModal(null);
    await refresh();
    if (view === "inventory") await loadInventory();
    if (view === "lost") await loadLost();
  };

  if (!data)
    return (
      <main className="launch-state">
        <BrandIcon />
        <span className="eyebrow">RECLAIM DESKTOP</span>
        <h1>Opening your workspace</h1>
        <p>{error || "Connecting to your local records…"}</p>
        <button className="button button-quiet" onClick={() => void refresh()}>
          Try again
        </button>
      </main>
    );

  if (!organization)
    return (
      <SetupWizard
        categories={data.categories}
        uiScale={uiScale}
        onUiScaleChange={setUiScale}
        onDone={async () => {
          await refresh();
          setToast("Your workspace is ready.");
        }}
      />
    );

  const navItems: {
    key: View;
    label: string;
    icon: LucideIcon;
    badge?: number;
    badgeSuffix?: string;
  }[] = [
    { key: "dashboard", label: "Overview", icon: Boxes },
    { key: "inventory", label: "Found items", icon: Package },
    {
      key: "lost",
      label: "Lost reports",
      icon: FileSearch,
      badge: stats.openReports,
      badgeSuffix: "open",
    },
    { key: "storage", label: "Storage", icon: MapPin },
    {
      key: "retention",
      label: "Retention review",
      icon: Clock3,
      badge: stats.retentionReview || undefined,
      badgeSuffix: "due",
    },
  ];

  return (
    <CategoryIconContext.Provider value={data.categories}>
      <div
        className="app-shell"
        data-theme={organization?.theme || "system"}
        style={
          {
            "--org-brand-color": organization?.primaryColor || DEFAULT_BRAND_COLOR,
            "--reclaim-ui-scale": uiScale,
          } as React.CSSProperties
        }
      >
        <aside className="sidebar">
          <div className="brand-lockup">
            <BrandLockup />
          </div>
          <div className="workspace-identity">
            <div className="workspace-avatar">
              {organization.logoDataUrl ? (
                <img src={organization.logoDataUrl} alt="" />
              ) : (
                initials(organization.name)
              )}
            </div>
            <div className="workspace-name">
              <strong>{organization.name}</strong>
            </div>
          </div>
          <div className="nav-caption">WORKSPACE</div>
          <nav className="primary-nav" aria-label="Main navigation">
            {navItems.map(({ key, label, icon: Icon, badge, badgeSuffix }) => (
              <button
                key={key}
                // The count chip is visible text, so the accessible name must
                // include it (WCAG 2.5.3 Label in Name).
                aria-label={badge ? `${label}, ${badge} ${badgeSuffix ?? ""}`.trim() : label}
                className={`nav-link ${view === key ? "active" : ""}`}
                onClick={() => void switchView(key)}
              >
                <Icon size={17} strokeWidth={1.8} />
                {/* The whitespace keeps visible-text extraction from gluing the
                    count chip onto the label ("Lost reports1"). */}
                <span>{label}</span> {badge ? <span className="nav-badge">{badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              aria-label="Settings"
              className={`nav-link ${view === "settings" ? "active" : ""}`}
              onClick={openSettings}
            >
              <Settings size={17} />
              <span>Settings</span>
            </button>
            <div className="sidebar-user">
              <div className="user-avatar">{initials(organization.staffName)}</div>
              <strong>{organization.staffName}</strong>
            </div>
          </div>
        </aside>
        <main className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{VIEW_TITLES[view]}</strong>
            </div>
            <div className="topbar-actions">
              <button
                className="icon-button mobile-settings-button"
                aria-label="Open Settings"
                title="Open Settings"
                onClick={openSettings}
              >
                <Settings size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Review lost reports"
                title="Review lost reports"
                onClick={() => void switchView("lost")}
              >
                <Bell size={18} />
              </button>
            </div>
          </header>
          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {view === "dashboard"
                    ? new Date()
                        .toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                        .toUpperCase()
                    : "YOUR WORKSPACE"}
                </div>
                <h1>
                  {view === "dashboard"
                    ? `${heading}, ${organization.name.split(" ")[0]}`
                    : heading}
                </h1>
                <p>{subtitle}</p>
              </div>
              <div className="heading-actions">
                {view !== "settings" && (
                  <>
                    <button className="button button-secondary" onClick={() => setModal("lost")}>
                      <Plus size={16} /> Lost report
                    </button>
                    <button className="button button-primary" onClick={openFound}>
                      <Plus size={17} /> Register found item
                    </button>
                  </>
                )}
              </div>
            </div>
            {error && (
              <div className="inline-alert" role="alert">
                <TriangleAlert size={16} />
                <span>{error}</span>
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="view-region">
              {view === "dashboard" && (
                <Dashboard
                  stats={stats}
                  items={items}
                  reports={lostReports}
                  onAllItems={() => setView("inventory")}
                  onAllReports={() => setView("lost")}
                  onSelect={setSelectedItem}
                  onFound={openFound}
                />
              )}
              {view === "inventory" && (
                <Inventory
                  items={items}
                  total={inventoryTotal}
                  page={inventoryPage}
                  setPage={setInventoryPage}
                  loading={inventoryLoading}
                  searchInputRef={searchInputRef}
                  dateFrom={dateFrom}
                  setDateFrom={setDateFrom}
                  dateTo={dateTo}
                  setDateTo={setDateTo}
                  categories={data.categories}
                  locations={data.storageLocations}
                  query={query}
                  setQuery={setQuery}
                  status={status}
                  setStatus={setStatus}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  storageFilter={storageFilter}
                  setStorageFilter={setStorageFilter}
                  view={inventoryView}
                  setView={setInventoryView}
                  onSelect={setSelectedItem}
                />
              )}
              {view === "lost" && (
                <LostReports
                  reports={lostReports}
                  total={lostTotal}
                  categories={data.categories}
                  query={query}
                  setQuery={setQuery}
                  status={status}
                  setStatus={setStatus}
                  onRefresh={loadLost}
                />
              )}
              {view === "storage" && (
                <StorageView
                  locations={data.storageLocations}
                  onAdd={() => {
                    setEditingStorage(null);
                    setModal("storage");
                  }}
                  onEdit={(location) => {
                    setEditingStorage(location);
                    setModal("storage");
                  }}
                  onChange={refresh}
                />
              )}
              {view === "retention" && (
                <RetentionView records={retentionRecords} onSelect={setSelectedItem} />
              )}
              {view === "settings" && (
                <SettingsView
                  organization={organization}
                  categories={data.categories}
                  locations={data.storageLocations}
                  section={settingsSection}
                  setSection={switchSettingsSection}
                  onOrgDirty={setOrgDirty}
                  uiScale={uiScale}
                  onUiScaleChange={setUiScale}
                  onUpdated={async (updated) => {
                    try {
                      await api.updateOrganization(updated);
                      await refresh();
                      setToast("Organization settings saved.");
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                  onCategory={() => {
                    setEditingCategory(null);
                    setModal("category");
                  }}
                  onEditCategory={(category) => {
                    setEditingCategory(category);
                    setModal("category");
                  }}
                  onStorage={() => {
                    setEditingStorage(null);
                    setModal("storage");
                  }}
                  onEditStorage={(location) => {
                    setEditingStorage(location);
                    setModal("storage");
                  }}
                  onRefresh={refresh}
                  onBackup={async () => {
                    try {
                      const result = await api.exportBackup();
                      if (!result) return;
                      setToast(`Backup verified · ${result.files.length} files included.`);
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                  onRestore={async () => {
                    try {
                      if (
                        !(await confirmDialog(
                          "Choose a verified Reclaim backup to replace the current records and item photos on this computer.",
                          { title: "Restore Reclaim backup", kind: "warning" },
                        ))
                      )
                        return;
                      const restored = await api.restoreBackup();
                      if (!restored) return;
                      setSelectedItem(null);
                      await refresh();
                      setToast("Backup restored and workspace integrity checked.");
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                />
              )}
            </div>
          </div>
          <footer className="statusbar" data-state={busy ? "busy" : error ? "failed" : "saved"}>
            <span aria-live="polite">
              <i /> {busy ? "Saving…" : error ? "Last action failed" : "All changes saved"}
            </span>
            <span>
              Reclaim desktop <b>·</b> v{packageJson.version}
            </span>
          </footer>
        </main>
        {modal && (
          <ModalFrame onClose={() => !busy && setModal(null)}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">{MODAL_COPY[modal].eyebrow}</div>
                <h2>
                  {modal === "storage" && editingStorage
                    ? "Edit storage location"
                    : MODAL_COPY[modal].heading}
                </h2>
                <p>{MODAL_COPY[modal].blurb}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => !busy && setModal(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {modal === "found" && (
              <FoundForm
                categories={data.categories}
                locations={data.storageLocations}
                busy={busy}
                onSubmit={async (input, photoPath) => {
                  setBusy(true);
                  try {
                    const item = await api.createFound(input);
                    let message = `${item.reference} added to inventory.`;
                    if (photoPath) {
                      try {
                        await api.importPhoto(item.id, photoPath);
                      } catch (e) {
                        message = `${item.reference} saved. Photo could not be added: ${String(e)}`;
                      }
                    }
                    await finishMutation(message);
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "edit" && selectedItem && (
              <FoundForm
                item={selectedItem}
                categories={data.categories}
                locations={data.storageLocations}
                busy={busy}
                onSubmit={async (input) => {
                  setBusy(true);
                  try {
                    const updated = await api.updateFound(selectedItem.id, input);
                    setSelectedItem(updated);
                    setModal(null);
                    await refresh();
                    setToast("Item details updated.");
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "lost" && (
              <LostForm
                categories={data.categories}
                busy={busy}
                onSubmit={async (input) => {
                  setBusy(true);
                  try {
                    const report = await api.createLost(input);
                    await finishMutation(`${report.reference} report created.`);
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "category" && (
              <CategoryForm
                category={editingCategory || undefined}
                busy={busy}
                onSubmit={async (input) => {
                  setBusy(true);
                  try {
                    await api.saveCategory(input);
                    setEditingCategory(null);
                    await finishMutation(editingCategory ? "Category updated." : "Category added.");
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "storage" && (
              <StorageForm
                location={editingStorage || undefined}
                locations={data.storageLocations}
                busy={busy}
                onSubmit={async (input) => {
                  setBusy(true);
                  try {
                    await api.saveStorageLocation({ ...input, id: editingStorage?.id });
                    setEditingStorage(null);
                    await finishMutation(
                      editingStorage ? "Storage location updated." : "Storage location added.",
                    );
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "return" && selectedItem && (
              <ReturnForm
                item={selectedItem}
                reports={lostReports}
                preselected={preselectedClaim}
                busy={busy}
                required={organization.requireVerification || selectedItem.storageSecure}
                onSubmit={async (input) => {
                  setBusy(true);
                  try {
                    await api.returnFound(input);
                    setSelectedItem(null);
                    await finishMutation(`${selectedItem.reference} marked as returned.`);
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "disposition" && selectedItem && (
              <DispositionForm
                item={selectedItem}
                busy={busy}
                onSubmit={async (method) => {
                  setBusy(true);
                  try {
                    await api.disposeFound(selectedItem.id, method);
                    setSelectedItem(null);
                    await finishMutation(`${selectedItem.reference} disposition recorded.`);
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </ModalFrame>
        )}
        {selectedItem && (
          <ItemDrawer
            item={selectedItem}
            modalActive={modal !== null}
            staffName={organization.staffName}
            locations={data.storageLocations}
            onClose={() => setSelectedItem(null)}
            onEdit={() => setModal("edit")}
            onReturn={async () => {
              // Preselect the adjudicated claim (if any) before the form mounts.
              const claim = await api.confirmedClaim(selectedItem.id).catch(() => null);
              setPreselectedClaim(claim);
              setModal("return");
            }}
            onDisposition={() => setModal("disposition")}
            onMove={async (id) => {
              try {
                await api.moveFound(selectedItem.id, id);
                setSelectedItem(null);
                await refresh();
                setToast("Item moved to a new location.");
              } catch (e) {
                setError(String(e));
              }
            }}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <span className="toast-check">
              <Check size={14} />
            </span>
            {toast}
            <button onClick={() => setToast("")} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </CategoryIconContext.Provider>
  );
}

function Dashboard({
  stats,
  items,
  reports,
  onAllItems,
  onAllReports,
  onSelect,
  onFound,
}: {
  stats: DashboardStats;
  items: FoundItem[];
  reports: LostReport[];
  onAllItems: () => void;
  onAllReports: () => void;
  onSelect: (item: FoundItem) => void;
  onFound: () => void;
}) {
  const photos = useItemPhotoPreviews(items);
  const metrics = [
    {
      label: "Items in custody",
      value: stats.held,
      change: "currently held",
      icon: Package,
      tone: "sand",
      trend: null,
    },
    {
      label: "Lost reports open",
      value: stats.openReports,
      change: "need a possible match",
      icon: FileSearch,
      tone: "blue",
      trend: null,
    },
    {
      label: "Found today",
      value: stats.foundToday,
      change: "registered today",
      icon: Sparkles,
      tone: "green",
      trend: null,
    },
    {
      label: "Ready for review",
      value: stats.retentionReview,
      change: "retention window",
      icon: Clock3,
      tone: "rose",
      trend: null,
    },
  ];
  return (
    <div className="dashboard-layout">
      <section className="metric-grid" aria-label="Operational summary">
        {metrics.map(({ label, value, change, icon: Icon }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={17} />
              </span>
            </div>
            <div className="metric-value">{value.toLocaleString()}</div>
            <div className="metric-foot">
              <span>{change}</span>
              <span className="metric-period">LIVE</span>
            </div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <div className="panel inventory-panel">
          <div className="panel-heading">
            <div>
              <h2>Latest arrivals</h2>
            </div>
            <button className="text-button" onClick={onAllItems}>
              View inventory <ArrowRight size={15} />
            </button>
          </div>
          {items.length ? (
            <div className="item-table">
              <div className="table-head">
                <span>ITEM</span>
                <span>REFERENCE</span>
                <span>LOCATION</span>
                <span>FOUND</span>
                <span />
              </div>
              {items.slice(0, 5).map((item) => (
                <button className="item-row" key={item.id} onClick={() => onSelect(item)}>
                  <span className="item-name-cell">
                    <ItemThumb
                      photo={photos[item.id]}
                      categoryId={item.categoryId}
                      tone={
                        item.categoryId.includes("phone") || item.categoryId.includes("computer")
                          ? "violet"
                          : item.categoryId === "clothing"
                            ? "peach"
                            : "mint"
                      }
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.categoryName}</small>
                    </span>
                  </span>
                  <span className="ref-cell">{item.reference}</span>
                  <span className="location-cell">
                    <MapPin size={13} />
                    {item.storageLocation}
                  </span>
                  <span className="date-cell">{dateLabel(item.foundAt)}</span>
                  <MoreHorizontal size={17} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="Your inventory is ready"
              text="Items you register will appear here, with their storage details and reference numbers."
              action="Register a found item"
              onClick={onFound}
            />
          )}
        </div>
        <aside className="panel attention-panel" aria-label="Open reports">
          <div className="panel-heading">
            <div>
              <h2>Open reports</h2>
            </div>
            <button
              className="icon-button small"
              aria-label="Review all lost reports"
              onClick={onAllReports}
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
          {reports.length ? (
            <div className="report-list">
              {reports.slice(0, 4).map((report) => (
                <div className="report-row" key={report.id}>
                  <span className="report-avatar">{initials(report.claimantName)}</span>
                  <div className="report-copy">
                    <strong>{report.name}</strong>
                    <span>
                      {report.claimantName} · {dateLabel(report.lostAt)}
                    </span>
                  </div>
                  <ArrowUpRight size={15} />
                </div>
              ))}
            </div>
          ) : (
            <div className="compact-empty">
              <span className="empty-icon blue">
                <FileSearch size={18} />
              </span>
              <strong>No open reports</strong>
            </div>
          )}
          <button className="wide-link" onClick={onAllReports}>
            Review lost reports <ArrowRight size={15} />
          </button>
        </aside>
      </section>
      {items.length > 0 && (
        <section className="panel gallery-panel" aria-label="Recently found item photographs">
          <div className="panel-heading">
            <div>
              <h2>Recently found, up close</h2>
            </div>
            <button className="text-button" onClick={onAllItems}>
              View inventory <ArrowRight size={15} />
            </button>
          </div>
          <RecentGallery items={items} onSelect={onSelect} />
        </section>
      )}
      <section className="quick-actions">
        <div className="quick-action-intro">
          <h2>Quick actions</h2>
        </div>
        <button onClick={onFound}>
          <span className="quick-icon">
            <Plus size={19} />
          </span>
          <span>
            <strong>Register found item</strong>
            <small>Give a new arrival a home</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={onAllReports}>
          <span className="quick-icon">
            <Search size={18} />
          </span>
          <span>
            <strong>Find a possible match</strong>
            <small>Compare new arrivals with reports</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={onAllItems}>
          <span className="quick-icon">
            <Archive size={18} />
          </span>
          <span>
            <strong>Browse inventory</strong>
            <small>Search everything in your care</small>
          </span>
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function RetentionView({
  records,
  onSelect,
}: {
  records: RetentionRecord[];
  onSelect: (item: FoundItem) => void;
}) {
  const photos = useItemPhotoPreviews(records.map((record) => record.item));
  const open = records.filter((record) => record.item.status === "in_custody");
  const disposed = records.filter((record) => record.item.status === "disposed");
  const row = (record: RetentionRecord) => (
    <button className="item-row" key={record.item.id} onClick={() => onSelect(record.item)}>
      <span className="item-name-cell">
        <ItemThumb photo={photos[record.item.id]} categoryId={record.item.categoryId} />
        <span>
          <strong>{record.item.name}</strong>
          <small>{record.item.categoryName}</small>
        </span>
      </span>
      <span className="ref-cell">{record.item.reference}</span>
      <span className="date-cell">{dateLabel(record.reviewDate)}</span>
      <span className={`status-pill ${record.eligible ? "muted" : "good"}`}>
        <i />
        {record.eligible ? "Eligible for review" : `${Math.max(record.daysRemaining, 0)} days left`}
      </span>
      <span>
        <StatusBadge status={record.item.status} />
      </span>
    </button>
  );
  return (
    <div className="retention-layout">
      <section className="panel full-panel">
        <div className="panel-heading panel-heading-end">
          <span className="retention-tag">{open.filter((r) => r.eligible).length} eligible</span>
        </div>
        <div className="settings-note">
          <CircleHelp size={16} />
          <span>
            Reclaim flags deadlines only. It never disposes of property automatically. Apply your
            organization’s local rules.
          </span>
        </div>
        {open.length ? (
          <div className="item-table inventory-table">
            <div className="table-head">
              <span>ITEM</span>
              <span>REFERENCE</span>
              <span>REVIEW DATE</span>
              <span>RETENTION</span>
              <span>STATUS</span>
            </div>
            {open.map(row)}
          </div>
        ) : (
          <EmptyState
            icon={Clock3}
            title="No items need retention review"
            text="Items in custody will appear here with their policy review dates."
          />
        )}
      </section>
      {disposed.length > 0 && (
        <section className="panel full-panel">
          <div className="panel-heading">
            <div>
              <h2>Already disposed</h2>
            </div>
          </div>
          <div className="item-table inventory-table">
            <div className="table-head">
              <span>ITEM</span>
              <span>REFERENCE</span>
              <span>REVIEW DATE</span>
              <span>RETENTION</span>
              <span>STATUS</span>
            </div>
            {disposed.map(row)}
          </div>
        </section>
      )}
    </div>
  );
}

function Inventory({
  items,
  total,
  page,
  setPage,
  loading,
  searchInputRef,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  categories,
  locations,
  query,
  setQuery,
  status,
  setStatus,
  categoryFilter,
  setCategoryFilter,
  storageFilter,
  setStorageFilter,
  view,
  setView,
  onSelect,
}: {
  items: FoundItem[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  loading: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  categories: Category[];
  locations: StorageLocation[];
  query: string;
  setQuery: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  storageFilter: string;
  setStorageFilter: (value: string) => void;
  view: InventoryView;
  setView: (view: InventoryView) => void;
  onSelect: (item: FoundItem) => void;
}) {
  const pageSize = 10,
    pages = Math.max(1, Math.ceil(total / pageSize));
  const reset = (change: () => void) => {
    change();
    setPage(1);
  };
  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setStorageFilter("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  const photos = useItemPhotoPreviews(items);
  return (
    <section className="panel full-panel inventory-screen">
      <div className="inventory-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            ref={searchInputRef}
            aria-label="Search inventory"
            placeholder="Search items or references…"
            value={query}
            onChange={(e) => reset(() => setQuery(e.target.value))}
          />
          <kbd>{IS_APPLE ? "⌘ K" : "Ctrl K"}</kbd>
        </div>
        <div className="select-control">
          <Filter size={15} />
          <SelectMenu
            ariaLabel="Filter by category"
            value={categoryFilter}
            onChange={(value) => reset(() => setCategoryFilter(value))}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="select-control">
          <MapPin size={15} />
          <SelectMenu
            ariaLabel="Filter by storage"
            value={storageFilter}
            onChange={(value) => reset(() => setStorageFilter(value))}
            options={[
              { value: "all", label: "All locations" },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </div>
        <div className="select-control status-select">
          <SelectMenu
            ariaLabel="Filter by status"
            value={status}
            onChange={(value) => reset(() => setStatus(value))}
            options={[
              { value: "all", label: "All status" },
              { value: "in_custody", label: "In custody" },
              { value: "returned", label: "Returned" },
              { value: "disposed", label: "Disposed" },
            ]}
          />
        </div>
        <div
          className="view-switcher"
          role="radiogroup"
          aria-label="Inventory view"
          data-view={view}
          onKeyDown={(event) =>
            rovingTabindexKeyDown(event, (value) =>
              setView(value === "gallery" ? "gallery" : "list"),
            )
          }
        >
          <button
            type="button"
            role="radio"
            aria-checked={view === "list"}
            tabIndex={view === "list" ? 0 : -1}
            data-value="list"
            className={view === "list" ? "selected" : ""}
            aria-label="List view"
            title="List view"
            onClick={() => setView("list")}
          >
            <List size={16} />
            <span>List</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === "gallery"}
            tabIndex={view === "gallery" ? 0 : -1}
            data-value="gallery"
            className={view === "gallery" ? "selected" : ""}
            aria-label="Gallery view"
            title="Gallery view"
            onClick={() => setView("gallery")}
          >
            <LayoutGrid size={16} />
            <span>Gallery</span>
          </button>
        </div>
      </div>
      <div className="list-summary">
        <span aria-live="polite">
          <strong>{total}</strong> items
        </span>
        <div className="date-filters">
          <label>
            Found from{" "}
            <input
              type="date"
              aria-label="Found from date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => reset(() => setDateFrom(e.target.value))}
            />
          </label>
          <label>
            to{" "}
            <input
              type="date"
              aria-label="Found through date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => reset(() => setDateTo(e.target.value))}
            />
          </label>
        </div>
      </div>
      {!items.length ? (
        <EmptyState
          icon={Package}
          title="No items match this search"
          text="Try a different reference, name, category, or storage location."
          action="Clear filters"
          actionIcon={RotateCcw}
          onClick={clearFilters}
        />
      ) : view === "list" ? (
        <div className="item-table inventory-table" data-loading={loading || undefined}>
          <div className="table-head">
            <span>ITEM</span>
            <span>REFERENCE</span>
            <span>STORAGE LOCATION</span>
            <span>DATE FOUND</span>
            <span>STATUS</span>
          </div>
          {items.map((item) => (
            <button className="item-row" key={item.id} onClick={() => onSelect(item)}>
              <span className="item-name-cell">
                <ItemThumb photo={photos[item.id]} categoryId={item.categoryId} />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.categoryName}
                    {item.color ? ` · ${item.color}` : ""}
                  </small>
                </span>
              </span>
              <span className="ref-cell">{item.reference}</span>
              <span className="location-cell">
                <MapPin size={13} />
                {item.storageLocation}
              </span>
              <span className="date-cell">{dateLabel(item.foundAt)}</span>
              <span>
                <StatusBadge status={item.status} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="inventory-gallery"
          role="region"
          aria-label="Inventory photo gallery"
          data-loading={loading || undefined}
        >
          {items.map((item) => (
            <button
              className="inventory-card"
              key={item.id}
              onClick={() => onSelect(item)}
              // Visible card text is name, category, date, and status — the
              // accessible name must contain it (WCAG 2.5.3).
              aria-label={`Open details for ${item.name}, ${item.categoryName}, ${dateLabel(item.foundAt)} — ${statusLabel(item.status)}`}
            >
              <ItemPhoto dataUrl={photos[item.id]} />
              <span className="inventory-card-copy">
                <strong>{item.name}</strong>{" "}
                <span className="inventory-card-meta">
                  <small>{item.categoryName}</small> <small>{dateLabel(item.foundAt)}</small>
                </span>{" "}
                <StatusBadge status={item.status} />
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="pagination">
        <span aria-live="polite">
          Showing{" "}
          <strong>
            {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}
          </strong>{" "}
          of <strong>{total}</strong> items
        </span>
        <div>
          <button disabled={page <= 1} aria-label="Previous page" onClick={() => setPage(page - 1)}>
            <ChevronLeft size={15} />
          </button>
          <span>
            Page <strong>{page}</strong> of <strong>{pages}</strong>
          </span>
          <button disabled={page >= pages} aria-label="Next page" onClick={() => setPage(page + 1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}

function LostReports({
  reports,
  total,
  categories,
  query,
  setQuery,
  status,
  setStatus,
  onRefresh,
}: {
  reports: LostReport[];
  total: number;
  categories: Category[];
  query: string;
  setQuery: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState<LostReport | null>(null);
  const [editing, setEditing] = useState<LostReport | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const reportSuccess = (text: string) => {
    setMessageError(false);
    setMessage(text);
  };
  const reportError = (error: unknown) => {
    setMessageError(true);
    setMessage(String(error));
  };
  const openMatches = async (report: LostReport) => {
    setReviewing(report);
    setLoading(true);
    setMatchError("");
    try {
      setCandidates(await api.matchingCandidates(report.id));
    } catch (e) {
      setMatchError(String(e));
    } finally {
      setLoading(false);
    }
  };
  const review = async (candidate: MatchCandidate, next: string) => {
    try {
      if (next === "confirmed") {
        const others = candidate.competingClaims
          .map((c) => `${c.claimantName} (${c.reference}, ${c.status})`)
          .join("; ");
        const detail = others
          ? ` Other open claims: ${others}. Selecting this claimant will dismiss those competing suggestions and retain the decision in custody history.`
          : " Selecting this claimant will be recorded in custody history.";
        if (
          !(await confirmDialog(
            `Select ${reviewing!.claimantName} as the leading claim for ${candidate.foundItem.name}?${detail} The item remains in custody until a verified return.`,
            { title: "Confirm leading claim", kind: "info" },
          ))
        )
          return;
        await api.adjudicateMatch(reviewing!.id, candidate.foundItem.id);
      } else await api.reviewMatch(reviewing!.id, candidate.foundItem.id, next);
      setCandidates(await api.matchingCandidates(reviewing!.id));
    } catch (e) {
      setMatchError(String(e));
    }
  };
  const changeStatus = async (report: LostReport) => {
    try {
      const next = report.status === "open" ? "closed" : "open";
      await api.setLostStatus(report.id, next);
      await onRefresh();
      reportSuccess(next === "open" ? "Lost report reopened." : "Lost report closed.");
    } catch (e) {
      reportError(e);
    }
  };
  const saveEdit = async (input: LostInput) => {
    try {
      await api.updateLost(editing!.id, input);
      setEditing(null);
      await onRefresh();
      reportSuccess("Lost report updated.");
    } catch (e) {
      reportError(e);
    }
  };
  return (
    <section className="panel full-panel">
      <div className="inventory-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search lost reports"
            placeholder="Search reports or claimants…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="select-control status-select">
          <SelectMenu
            ariaLabel="Filter reports"
            value={status}
            onChange={(value) => setStatus(value)}
            options={[
              { value: "open", label: "Open reports" },
              { value: "all", label: "All reports" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </div>
      </div>
      <div className="list-summary">
        <span aria-live="polite">
          {reports.length === total ? (
            <>
              <strong>{total}</strong> reports
            </>
          ) : (
            <>
              <strong>{reports.length}</strong> of <strong>{total}</strong> reports · showing the
              first {reports.length}
            </>
          )}
        </span>
        <span className="advisory-note">
          <Sparkles size={14} /> Scores rank details for staff review; they do not verify ownership.
        </span>
      </div>
      {message && (
        <div
          className={messageError ? "inline-alert" : "inline-status"}
          role={messageError ? "alert" : "status"}
        >
          {message}
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {reports.length ? (
        <div className="lost-list">
          {reports.map((report) => (
            <article className="lost-row" key={report.id}>
              <div className="report-avatar large">{initials(report.claimantName)}</div>
              <div className="lost-main">
                <div className="lost-title">
                  <strong>{report.name}</strong>
                  <StatusBadge status={report.status} />
                </div>
                <span>
                  {report.categoryName} · {report.color || "Color not noted"}
                  {report.brand ? ` · ${report.brand}` : ""}
                </span>
                <p>{report.description || "No additional item details provided."}</p>
              </div>
              <div className="lost-meta">
                <span className="ref-cell">{report.reference}</span>
                <span>Lost {dateLabel(report.lostAt)}</span>
                <span>
                  {report.claimantName}
                  {report.contact ? ` · ${report.contact}` : ""}
                </span>
                <span className="location-cell">
                  <MapPin size={13} />
                  {report.lastLocation || "Location not noted"}
                </span>
              </div>
              <div className="lost-actions">
                <button
                  className="button button-small button-secondary"
                  onClick={() => void openMatches(report)}
                >
                  Review matches
                </button>
                <button
                  className="button button-small button-quiet"
                  disabled={report.status === "resolved"}
                  onClick={() => setEditing(report)}
                >
                  Edit
                </button>
                {report.status !== "resolved" && (
                  <button
                    className="button button-small button-quiet"
                    onClick={() => void changeStatus(report)}
                  >
                    {report.status === "open" ? "Close report" : "Reopen report"}
                  </button>
                )}
                {report.status === "resolved" && (
                  <button
                    className="button button-small button-quiet"
                    onClick={() => void changeStatus(report)}
                  >
                    Reopen report
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileSearch}
          title="No open reports yet"
          text="When someone reports an item missing, their report and contact details will be here."
        />
      )}
      {editing && (
        <ModalFrame onClose={() => setEditing(null)}>
          <div className="modal-heading">
            <div>
              <span className="eyebrow">EDIT LOST REPORT · {editing.reference}</span>
              <h2>Update report details</h2>
              <p>Changes are saved to the local record and reflected in match review.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Close editor"
              onClick={() => setEditing(null)}
            >
              <X size={18} />
            </button>
          </div>
          <LostForm
            report={editing}
            categories={categories}
            busy={false}
            onSubmit={(input) => void saveEdit(input)}
          />
        </ModalFrame>
      )}
      {reviewing && (
        <ModalFrame onClose={() => setReviewing(null)}>
          <div className="modal-heading">
            <div>
              <span className="eyebrow">POSSIBLE MATCHES · {reviewing.reference}</span>
              <h2>{reviewing.name}</h2>
              <p>Compare details with items currently in custody. A score is only a ranking aid.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Close matches"
              onClick={() => setReviewing(null)}
            >
              <X size={18} />
            </button>
          </div>
          {matchError && (
            <div className="inline-alert" role="alert">
              {matchError}
            </div>
          )}
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Sparkles size={21} />
              </span>
              <strong>Comparing details</strong>
              <p>Checking category, description, color, dates, and location.</p>
            </div>
          ) : candidates.length ? (
            <div className="candidate-list">
              {candidates.map((candidate) => (
                <article className="candidate-card" key={candidate.foundItem.id}>
                  <div className="candidate-top">
                    <span className="item-icon mint">
                      <ItemIcon categoryId={candidate.foundItem.categoryId} />
                    </span>
                    <div>
                      <strong>{candidate.foundItem.name}</strong>
                      <small>
                        {candidate.foundItem.reference} · {candidate.foundItem.categoryName}
                      </small>
                    </div>
                    <span className="match-score">
                      {candidate.score}
                      <small> / 100</small>
                    </span>
                  </div>
                  <div className="candidate-facts">
                    <span>
                      <MapPin size={13} />
                      {candidate.foundItem.foundLocation || candidate.foundItem.storageLocation}
                    </span>
                    <span>
                      <CalendarDays size={13} />
                      Found {dateLabel(candidate.foundItem.foundAt)}
                    </span>
                  </div>
                  <p className="candidate-explanation">
                    {candidate.explanation.length
                      ? candidate.explanation.join(" · ")
                      : "Few details overlap. Review the item manually."}
                  </p>
                  {candidate.competingClaims.length > 0 && (
                    <div className="settings-note competing-claims" role="status">
                      <ShieldCheck size={15} />
                      <span>
                        <strong>
                          {candidate.competingClaims.length} competing open claim
                          {candidate.competingClaims.length === 1 ? "" : "s"}
                        </strong>
                        {candidate.competingClaims.map((claim) => (
                          <small key={claim.reportId}>
                            {claim.claimantName} · {claim.reference} · {claim.status} ·{" "}
                            {claim.score}/100
                          </small>
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="candidate-actions">
                    {candidate.reviewStatus === "confirmed" ? (
                      <>
                        <span className="association-note">
                          Associated claim · verify ownership before return
                        </span>
                        <button
                          className="button button-secondary button-small"
                          onClick={() => void review(candidate, "dismissed")}
                        >
                          Remove association
                        </button>
                      </>
                    ) : candidate.reviewStatus === "dismissed" ? (
                      <button
                        className="button button-secondary button-small"
                        onClick={() => void review(candidate, "suggested")}
                      >
                        Reopen suggestion
                      </button>
                    ) : (
                      <>
                        <button
                          className="button button-quiet button-small"
                          onClick={() => void review(candidate, "dismissed")}
                        >
                          Dismiss suggestion
                        </button>
                        <button
                          className="button button-primary button-small"
                          onClick={() => void review(candidate, "confirmed")}
                        >
                          Select this claim <ArrowRight size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileSearch}
              title="No suggested matches"
              text="There are no active found items with overlapping details. You can check again after new items are registered."
            />
          )}
          <div className="match-disclaimer">
            <CircleHelp size={14} /> Similarity scores are ranking heuristics, not probabilities or
            proof of ownership.
          </div>
        </ModalFrame>
      )}
    </section>
  );
}

function StorageView({
  locations,
  onAdd,
  onEdit,
  onChange,
}: {
  locations: StorageLocation[];
  onAdd: () => void;
  onEdit: (location: StorageLocation) => void;
  onChange: () => void;
}) {
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const toggle = async (location: StorageLocation) => {
    try {
      await api.setStorageActive(location.id, !location.active);
      await onChange();
      setMessageError(false);
      setMessage(location.active ? "Location archived." : "Location restored.");
    } catch (e) {
      setMessageError(true);
      setMessage(String(e));
    }
  };
  return (
    <section className="storage-layout">
      <div className="panel storage-main">
        <div className="panel-heading panel-heading-end">
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} /> Add location
          </button>
        </div>
        {message && (
          <div
            className={messageError ? "inline-alert" : "inline-status"}
            role={messageError ? "alert" : "status"}
            aria-live="polite"
          >
            {message}
            <button aria-label="Dismiss storage message" onClick={() => setMessage("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="storage-list">
          {locations.map((location) => (
            <article
              className={`storage-row ${!location.active ? "archived" : ""}`}
              key={location.id}
            >
              <span className={`storage-marker ${location.secure ? "secure" : ""}`}>
                {location.secure ? <ShieldCheck size={18} /> : <MapPin size={18} />}
              </span>
              <div className="storage-copy">
                <strong>{location.name}</strong>
                <span>
                  {location.description || "Storage area"}
                  {location.parentName ? ` · inside ${location.parentName}` : ""}
                  {location.organizationLocationName
                    ? ` · ${location.organizationLocationName}`
                    : ""}
                </span>
              </div>
              <span className={`storage-tag ${location.secure ? "secure" : ""}`}>
                {location.secure ? "SECURE" : "GENERAL"}
              </span>
              <span className={`status-pill ${location.active ? "good" : "muted"}`}>
                <i />
                {location.active ? "Active" : "Archived"}
              </span>
              <button
                type="button"
                className="button button-quiet button-small"
                aria-label={`Edit storage location ${location.name}`}
                onClick={() => onEdit(location)}
              >
                Edit
              </button>
              <button
                className="icon-button small"
                aria-label={`${location.active ? "Archive" : "Restore"} ${location.name}`}
                onClick={() => void toggle(location)}
              >
                {location.active ? <Archive size={16} /> : <ArrowDownRight size={16} />}
              </button>
            </article>
          ))}
        </div>
        {!locations.length && (
          <EmptyState
            icon={MapPin}
            title="No storage locations yet"
            text="Create your first location to start assigning found items."
            action="Add a location"
            onClick={onAdd}
          />
        )}
        <div className="storage-footnote">
          <ShieldCheck size={15} />
          <span>
            Items in secure locations require staff to document an ownership verification method
            before return.
          </span>
        </div>
      </div>
    </section>
  );
}

function SettingsView({
  organization,
  categories,
  locations,
  section,
  setSection,
  onOrgDirty,
  onUpdated,
  uiScale,
  onUiScaleChange,
  onCategory,
  onEditCategory,
  onStorage,
  onEditStorage,
  onRefresh,
  onBackup,
  onRestore,
}: {
  organization: Organization;
  categories: Category[];
  locations: StorageLocation[];
  section: SettingsSection;
  setSection: (section: SettingsSection) => void;
  onOrgDirty: (dirty: boolean) => void;
  onUpdated: (organization: Organization) => void;
  uiScale: number;
  onUiScaleChange: (scale: number) => void;
  onCategory: () => void;
  onEditCategory: (category: Category) => void;
  onStorage: () => void;
  onEditStorage: (location: StorageLocation) => void;
  onRefresh: () => void;
  onBackup: () => void;
  onRestore: () => void;
}) {
  const sections: [typeof section, string, string][] = [
    ["organization", "Organization", "Identity and contact"],
    ["categories", "Categories", "Item types"],
    ["storage", "Storage", "Physical locations"],
    ["policies", "Policies", "Retention and returns"],
    ["data", "Data", "Backup and restore"],
    ["appearance", "Appearance", "Theme and display"],
  ];
  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {sections.map(([key, label, desc]) => (
          <button
            className={section === key ? "selected" : ""}
            key={key}
            onClick={() => setSection(key)}
          >
            <span>{label}</span>
            <small>{desc}</small>
            <ChevronRight size={15} />
          </button>
        ))}
      </nav>
      <section className="panel settings-panel">
        {section === "organization" && (
          <OrganizationSettings
            organization={organization}
            onUpdated={onUpdated}
            onDirtyChange={onOrgDirty}
          />
        )}
        {section === "categories" && (
          <>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">ITEM TAXONOMY</span>
                <h2>Categories</h2>
                <p>Keep descriptions clear so staff can find the right place for any item.</p>
              </div>
              <button className="button button-primary" onClick={onCategory}>
                <Plus size={15} /> Add category
              </button>
            </div>
            <div className="settings-category-list">
              {categories.map((category, i) => {
                const Icon = iconMap[category.icon] || Package;
                const reorder = (direction: -1 | 1) => {
                  const target = i + direction;
                  if (target < 0 || target >= categories.length) return;
                  const ids = categories.map((c) => c.id);
                  [ids[i], ids[target]] = [ids[target], ids[i]];
                  void api.reorderCategories(ids).then(onRefresh);
                };
                return (
                  <div className="settings-category" key={category.id}>
                    <span className="reorder-cluster">
                      <button
                        className="reorder-button"
                        type="button"
                        disabled={i === 0}
                        onClick={() => reorder(-1)}
                        aria-label={`Move ${category.name} up`}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        className="reorder-button"
                        type="button"
                        disabled={i === categories.length - 1}
                        onClick={() => reorder(1)}
                        aria-label={`Move ${category.name} down`}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </span>
                    <span className="item-icon mint">
                      <Icon size={17} />
                    </span>
                    <div>
                      <strong>{category.name}</strong>
                      <small>{category.description || "Standard category"}</small>
                    </div>
                    {category.retentionDays && (
                      <span className="retention-tag">{category.retentionDays} day retention</span>
                    )}
                    <span className={`category-status ${category.active ? "" : "muted"}`}>
                      <i />
                      {category.active ? "Active" : "Archived"}
                    </span>
                    <button
                      className="button button-quiet button-small"
                      onClick={() => onEditCategory(category)}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-button small"
                      aria-label={`${category.active ? "Archive" : "Restore"} ${category.name}`}
                      onClick={() =>
                        void api.setCategoryActive(category.id, !category.active).then(onRefresh)
                      }
                    >
                      {category.active ? <Archive size={15} /> : <ArrowDownRight size={15} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {section === "storage" && (
          <>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">PHYSICAL INVENTORY MAP</span>
                <h2>Storage locations</h2>
                <p>Assign items to rooms, cabinets, drawers, and secure spaces.</p>
              </div>
              <button className="button button-primary" onClick={onStorage}>
                <Plus size={15} /> Add location
              </button>
            </div>
            <div className="settings-category-list">
              {locations.map((location) => (
                <div className="settings-category" key={location.id}>
                  <span
                    className={`storage-marker small-marker ${location.secure ? "secure" : ""}`}
                  >
                    {location.secure ? <ShieldCheck size={16} /> : <MapPin size={16} />}
                  </span>
                  <div>
                    <strong>{location.name}</strong>
                    <small>
                      {location.parentName ? `Inside ${location.parentName} · ` : ""}
                      {location.description || "Storage area"}
                      {location.organizationLocationName
                        ? ` · ${location.organizationLocationName}`
                        : ""}
                    </small>
                  </div>
                  <span className={`status-pill ${location.active ? "good" : "muted"}`}>
                    <i />
                    {location.active ? (location.secure ? "Secure" : "Active") : "Archived"}
                  </span>
                  <button
                    type="button"
                    className="button button-quiet button-small"
                    onClick={() => onEditStorage(location)}
                  >
                    Edit
                  </button>
                  <button
                    className="icon-button small"
                    aria-label={`${location.active ? "Archive" : "Restore"} ${location.name}`}
                    onClick={() =>
                      void api.setStorageActive(location.id, !location.active).then(onRefresh)
                    }
                  >
                    {location.active ? <Archive size={15} /> : <ArrowDownRight size={15} />}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {section === "policies" && (
          <PolicySettings organization={organization} onUpdated={onUpdated} />
        )}
        {section === "data" && <DataSettings onBackup={onBackup} onRestore={onRestore} />}
        {section === "appearance" && (
          <AppearanceSettings
            organization={organization}
            onUpdated={onUpdated}
            uiScale={uiScale}
            onUiScaleChange={onUiScaleChange}
          />
        )}
      </section>
    </div>
  );
}

/** Organization fields editable on the organization settings form; dirty tracking compares exactly these. */
const ORG_FIELDS: (keyof Organization)[] = [
  "name",
  "organizationType",
  "phone",
  "email",
  "street",
  "city",
  "region",
  "postalCode",
  "country",
  "staffName",
  "primaryColor",
  "logoDataUrl",
  "operatingHours",
];
function OrganizationSettings({
  organization,
  onUpdated,
  onDirtyChange,
}: {
  organization: Organization;
  onUpdated: (value: Organization) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState(organization);
  const set = (key: keyof Organization, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));
  // Report unsaved edits upward so navigation can confirm before discarding them.
  const dirty = ORG_FIELDS.some((field) => form[field] !== organization[field]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  return (
    <>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          onUpdated(form);
        }}
      >
        <div className="panel-heading">
          <div>
            <span className="section-kicker">YOUR WORKSPACE</span>
            <h2>Organization details</h2>
            <p>These details appear in your local workspace and backup records.</p>
          </div>
          <button className="button button-primary" type="submit">
            <Check size={15} /> Save changes
          </button>
        </div>
        <div className="form-grid">
          <Field label="Organization name" required>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Organization type">
            <input
              value={form.organizationType}
              onChange={(e) => set("organizationType", e.target.value)}
            />
          </Field>
          <Field label="Primary phone">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email address">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Street address">
            <input value={form.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="State or region">
            <input value={form.region} onChange={(e) => set("region", e.target.value)} />
          </Field>
          <Field label="Postal code">
            <input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </Field>
          <Field label="Country">
            <input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="Current staff attribution name">
            <input
              value={form.staffName}
              onChange={(e) => set("staffName", e.target.value)}
              maxLength={80}
              required
            />
          </Field>
        </div>
        <LogoAndColor
          primaryColor={form.primaryColor}
          logoDataUrl={form.logoDataUrl}
          onColor={(value) => setForm((f) => ({ ...f, primaryColor: value }))}
          onLogo={(value) => setForm((f) => ({ ...f, logoDataUrl: value }))}
        />
        <HoursEditor
          value={form.operatingHours}
          onChange={(value) => set("operatingHours", value)}
          locale={form.locale}
        />
        {form.legacyOperatingHours && (
          <div className="settings-note">
            <CircleHelp size={16} />
            <span>
              Previous operating-hours text was preserved during the upgrade: “
              {form.legacyOperatingHours}”. Review and replace it with the structured weekly
              schedule above.
            </span>
          </div>
        )}
        <div className="settings-note">
          <CircleHelp size={16} />
          <span>
            {form.staffName} is an offline attribution label used in custody history. Reclaim does
            not authenticate staff accounts or enforce role permissions.
          </span>
        </div>
        <div className="settings-note">
          <ShieldCheck size={16} />
          <span>
            Reclaim stores these records in the app data folder on this computer. Your workspace
            does not require an online account.
          </span>
        </div>
      </form>
      <OrganizationLocations />
    </>
  );
}
function PolicySettings({
  organization,
  onUpdated,
}: {
  organization: Organization;
  onUpdated: (value: Organization) => void;
}) {
  const [form, setForm] = useState(organization);
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        onUpdated(form);
      }}
    >
      <div className="panel-heading">
        <div>
          <span className="section-kicker">RETURN &amp; RETENTION</span>
          <h2>Operational policies</h2>
          <p>Set defaults for how long property is held and what staff record at return.</p>
        </div>
        <button className="button button-primary" type="submit">
          <Check size={15} /> Save policies
        </button>
      </div>
      <div className="policy-setting">
        <div>
          <strong>Default retention period</strong>
          <p>
            How many days an unclaimed item is held before a staff member reviews it for
            disposition.
          </p>
        </div>
        <label className="input-with-suffix">
          <input
            type="number"
            min="1"
            max="3650"
            value={form.retentionDays}
            onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })}
          />
          <span>days</span>
        </label>
      </div>
      <label className="behavior-choice">
        <span className="choice-check">{form.requireVerification && <Check size={13} />}</span>
        <span>
          <strong>Require ownership verification for every return</strong>
          <small>
            Secure storage always requires verification, even if this default is turned off.
          </small>
        </span>
        <input
          type="checkbox"
          checked={form.requireVerification}
          onChange={(e) => setForm({ ...form, requireVerification: e.target.checked })}
        />
      </label>
      <label className="behavior-choice">
        <span className="choice-check">{form.allowAnonymousFinders && <Check size={13} />}</span>
        <span>
          <strong>Allow staff to record anonymous finders</strong>
          <small>Finder contact details remain optional on an item record.</small>
        </span>
        <input
          type="checkbox"
          checked={form.allowAnonymousFinders}
          onChange={(e) => setForm({ ...form, allowAnonymousFinders: e.target.checked })}
        />
      </label>
      <div className="settings-note">
        <CircleHelp size={16} />
        <span>
          Retention dates flag items for staff review. Reclaim will never dispose of property
          automatically. Apply your organization’s local rules.
        </span>
      </div>
    </form>
  );
}
function OrganizationLocations() {
  const [locations, setLocations] = useState<OrganizationLocation[]>([]);
  const [editing, setEditing] = useState<OrganizationLocation | null>(null);
  const [form, setForm] = useState({
    name: "",
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
  });
  const [message, setMessage] = useState("");
  const load = () =>
    void api
      .listOrganizationLocations(true)
      .then(setLocations)
      .catch((e) => setMessage(String(e)));
  useEffect(load, []);
  const reset = () => {
    setEditing(null);
    setForm({ name: "", street: "", city: "", region: "", postalCode: "", country: "" });
  };
  const beginEdit = (location: OrganizationLocation) => {
    setEditing(location);
    setForm({
      name: location.name,
      street: location.street,
      city: location.city,
      region: location.region,
      postalCode: location.postalCode,
      country: location.country,
    });
  };
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.saveOrganizationLocation({ id: editing?.id || crypto.randomUUID(), ...form });
      setMessage(editing ? "Organization location updated." : "Organization location added.");
      reset();
      load();
    } catch (e) {
      setMessage(String(e));
    }
  };
  return (
    <section className="organization-locations">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">SITES &amp; BUILDINGS</span>
          <h3>Organization locations</h3>
          <p>Add or edit the buildings and service sites where items are found.</p>
        </div>
      </div>
      <form className="form-grid two" onSubmit={save}>
        <Field label="Location name" required>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            maxLength={120}
            placeholder="East campus"
          />
        </Field>
        <Field label="Street address">
          <input
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
            maxLength={240}
            autoComplete="street-address"
          />
        </Field>
        <Field label="City">
          <input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            maxLength={120}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="State or region">
          <input
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
            maxLength={120}
            autoComplete="address-level1"
          />
        </Field>
        <Field label="Postal code">
          <input
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            maxLength={32}
            autoComplete="postal-code"
          />
        </Field>
        <Field label="Country">
          <input
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            maxLength={120}
            autoComplete="country-name"
          />
        </Field>
        <div className="site-form-actions">
          <button className="button button-secondary button-small">
            {editing ? "Save location" : "Add organization location"}
          </button>
          {editing && (
            <button type="button" className="button button-quiet button-small" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {message && (
        <div role="status" className="settings-note">
          {message}
        </div>
      )}
      <div className="settings-category-list">
        {locations.map((l) => (
          <div className="settings-category" key={l.id}>
            <MapPin size={16} />
            <div>
              <strong>{l.name}</strong>
              <small>
                {[l.street, l.city, l.region, l.postalCode, l.country]
                  .filter(Boolean)
                  .join(" · ") || "No address"}
              </small>
            </div>
            <span className={`status-pill ${l.active ? "good" : "muted"}`}>
              {l.active ? "Active" : "Archived"}
            </span>
            <button
              type="button"
              className="button button-quiet button-small"
              aria-label={`Edit site ${l.name}`}
              onClick={() => beginEdit(l)}
            >
              Edit
            </button>
            <button
              type="button"
              className="button button-quiet button-small"
              aria-label={`${l.active ? "Archive" : "Restore"} site ${l.name}`}
              disabled={l.active && locations.filter((x) => x.active).length <= 1}
              onClick={() =>
                void api
                  .setOrganizationLocationActive(l.id, !l.active)
                  .then(load)
                  .catch((e) => setMessage(String(e)))
              }
            >
              {l.active ? "Archive" : "Restore"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
function AppearanceSettings({
  organization,
  onUpdated,
  uiScale,
  onUiScaleChange,
}: {
  organization: Organization;
  onUpdated: (value: Organization) => void;
  uiScale: number;
  onUiScaleChange: (scale: number) => void;
}) {
  const choices: ThemeChoice[] = [
    ["light", "Light", "A bright, warm workspace."],
    ["dark", "Dark", "A lower-light interface for dim rooms."],
    ["system", "Match device", "Follow your computer’s appearance setting."],
  ];
  return (
    <div className="appearance-settings">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">COMFORT &amp; CLARITY</span>
          <h2>Appearance</h2>
          <p>Choose how Reclaim looks on this computer.</p>
        </div>
      </div>
      <ThemeRadioGroup
        label="Appearance theme"
        choices={choices}
        value={organization.theme}
        onChange={(theme) => onUpdated({ ...organization, theme })}
      />
      <div className="appearance-size">
        <h3>Text and interface size</h3>
        <p>Adjust text and primary control targets across the workspace.</p>
        <UiSizeControl scale={uiScale} onChange={onUiScaleChange} />
      </div>
      <div className="settings-note">
        <ShieldCheck size={16} />
        <span>
          Appearance is stored with your workspace preferences and restored from your backup.
        </span>
      </div>
    </div>
  );
}
function DataSettings({ onBackup, onRestore }: { onBackup: () => void; onRestore: () => void }) {
  return (
    <div className="data-settings">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">YOUR RECORDS, YOUR DEVICE</span>
          <h2>Backup &amp; restore</h2>
          <p>Keep a verified copy of your database and item photos somewhere safe.</p>
        </div>
      </div>
      <div className="data-summary">
        <span className="data-icon">
          <Archive size={18} />
        </span>
        <div>
          <strong>Private local workspace</strong>
          <small>SQLite database · versioned schema · managed item photos</small>
        </div>
        <span className="data-status">
          <i /> On this device
        </span>
      </div>
      <div className="data-actions">
        <article>
          <div className="data-action-icon">
            <ArrowUpRight size={17} />
          </div>
          <h3>Create a backup</h3>
          <p>
            Exports a consistent database snapshot, item photos, and an integrity manifest to a
            location you choose.
          </p>
          <button className="button button-primary" onClick={onBackup}>
            Choose backup destination <ArrowRight size={14} />
          </button>
        </article>
        <article>
          <div className="data-action-icon restore">
            <ArrowDownRight size={17} />
          </div>
          <h3>Restore a workspace</h3>
          <p>
            Validates the archive and replaces the current workspace after you confirm. Failed
            restores recover the prior data.
          </p>
          <button className="button button-secondary" onClick={onRestore}>
            Choose backup to restore
          </button>
        </article>
      </div>
      <div className="settings-note">
        <CircleHelp size={16} />
        <span>
          Backups are local files. Store copies on a protected external drive or
          organization-managed location. Restore replaces current records and photos.
        </span>
      </div>
    </div>
  );
}

type OperatingDay = {
  day: string;
  closed: boolean;
  opens: string;
  closes: string;
  overnight: boolean;
};
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const defaultHours: OperatingDay[] = DAY_NAMES.map((day, i) => ({
  day,
  closed: i > 4,
  opens: "09:00",
  closes: "17:00",
  overnight: false,
}));
function parseHours(value: string): OperatingDay[] {
  try {
    const parsed = JSON.parse(value) as OperatingDay[];
    if (
      Array.isArray(parsed) &&
      parsed.length === 7 &&
      parsed.every(
        (d, i) =>
          d.day === DAY_NAMES[i] &&
          typeof d.closed === "boolean" &&
          typeof d.opens === "string" &&
          typeof d.closes === "string" &&
          typeof d.overnight === "boolean",
      )
    )
      return parsed;
  } catch {}
  return defaultHours.map((d) => ({ ...d }));
}
function HoursEditor({
  value,
  onChange,
  locale,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
}) {
  const days = parseHours(value);
  const update = (index: number, part: Partial<OperatingDay>) =>
    onChange(JSON.stringify(days.map((day, i) => (i === index ? { ...day, ...part } : day))));
  const copyWeekdays = () => {
    const monday = days[0];
    onChange(
      JSON.stringify(
        days.map((d, i) =>
          i < 5
            ? {
                ...d,
                closed: monday.closed,
                opens: monday.opens,
                closes: monday.closes,
                overnight: monday.overnight,
              }
            : d,
        ),
      ),
    );
  };
  const applyOpen = () => {
    const monday = days[0];
    onChange(
      JSON.stringify(
        days.map((d) =>
          d.closed
            ? d
            : { ...d, opens: monday.opens, closes: monday.closes, overnight: monday.overnight },
        ),
      ),
    );
  };
  const hourValue = (time: string) =>
    new Date(`2000-01-01T${time}:00`).toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  return (
    <section className="hours-editor" aria-label="Weekly operating hours">
      <div className="hours-editor-heading">
        <strong>Business operating hours</strong>
        <div>
          <button type="button" className="text-button" onClick={copyWeekdays}>
            Copy Monday to weekdays
          </button>
          <button type="button" className="text-button" onClick={applyOpen}>
            Apply Monday’s hours to open days
          </button>
        </div>
      </div>
      {days.map((day, i) => (
        <div className="hours-row" key={day.day}>
          <strong id={`hours-day-${i}`}>{day.day}</strong>
          <label className="hours-open">
            <input
              type="checkbox"
              checked={!day.closed}
              aria-label={`${day.day} open`}
              onChange={(e) => update(i, { closed: !e.target.checked })}
            />
            <span>{day.closed ? "Closed" : "Open"}</span>
          </label>
          {day.closed ? null : (
            <>
              <label className="hours-time">
                <span className="hours-time-label">Opens</span>{" "}
                <input
                  aria-label={`${day.day} opening time`}
                  type="time"
                  lang={locale}
                  value={day.opens}
                  onChange={(e) => update(i, { opens: e.target.value })}
                />
                <small>{hourValue(day.opens)}</small>
              </label>
              <label className="hours-time">
                <span className="hours-time-label">Closes</span>{" "}
                <input
                  aria-label={`${day.day} closing time`}
                  type="time"
                  lang={locale}
                  value={day.closes}
                  onChange={(e) => update(i, { closes: e.target.value })}
                />
                <small>{hourValue(day.closes)}</small>
              </label>
              <label className="overnight-choice">
                <input
                  type="checkbox"
                  checked={day.overnight}
                  aria-label={`${day.day} closes next day`}
                  onChange={(e) => update(i, { overnight: e.target.checked })}
                />{" "}
                Closes next day
              </label>
              {!day.overnight && day.closes <= day.opens && (
                <span className="hours-error" role="alert">
                  Closing time must be later than opening time, or mark overnight.
                </span>
              )}
              {day.overnight && day.closes >= day.opens && (
                <span className="hours-error" role="alert">
                  An overnight close time must be earlier than the opening time; for 24-hour
                  service, close at 23:59.
                </span>
              )}
            </>
          )}
        </div>
      ))}
      <p className="hours-summary">{hoursSummary(value, locale)}</p>
    </section>
  );
}
function accessibleBrandColor(value: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return false;
  const rgb = value
    .slice(1)
    .match(/.{2}/g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] <= 0.183;
}
function LogoAndColor({
  primaryColor,
  logoDataUrl,
  onColor,
  onLogo,
}: {
  primaryColor: string;
  logoDataUrl: string | null;
  onColor: (v: string) => void;
  onLogo: (v: string | null) => void;
}) {
  const [error, setError] = useState("");
  const read = (file?: File) => {
    if (!file) return;
    setError("");
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("Choose a PNG, JPEG, or WebP image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLogo(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Could not read this image.");
    reader.readAsDataURL(file);
  };
  return (
    <div className="branding-controls">
      <div className="logo-control">
        <span className="field-label">
          Organization logo <small>Optional · PNG, JPEG, WebP · up to 2 MB</small>
        </span>
        <div className="logo-preview">
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="Organization logo preview" />
          ) : (
            <span>{"Logo"}</span>
          )}
        </div>
        <label className="button button-secondary button-small">
          {logoDataUrl ? "Replace logo" : "Upload logo"}
          <input
            aria-label="Upload organization logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => read(e.currentTarget.files?.[0])}
          />
        </label>
        {logoDataUrl && (
          <button
            type="button"
            className="button button-quiet button-small"
            onClick={() => onLogo(null)}
          >
            Remove logo
          </button>
        )}
        {error && (
          <span role="alert" className="hours-error">
            {error}
          </span>
        )}
      </div>
      <fieldset className="brand-color-control">
        <legend>Primary brand color</legend>
        <div className="brand-swatches">
          {BRAND_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use brand color ${color}`}
              aria-pressed={primaryColor.toLowerCase() === color}
              style={{ backgroundColor: color }}
              onClick={() => onColor(color)}
            />
          ))}
        </div>
        <div className="brand-color-entry">
          <input
            aria-label="Choose custom primary color"
            type="color"
            value={primaryColor}
            onChange={(e) => onColor(e.target.value)}
          />
          <label>
            Hex value
            <input
              aria-label="Primary color hex value"
              value={primaryColor}
              maxLength={7}
              onChange={(e) => onColor(e.target.value)}
              aria-invalid={!accessibleBrandColor(primaryColor)}
            />
          </label>
        </div>
        {!accessibleBrandColor(primaryColor) && (
          <small className="hours-error" role="alert">
            Choose a color with at least 4.5:1 contrast against white text.
          </small>
        )}
        <div className="brand-preview">
          <button className="button button-primary" disabled={!accessibleBrandColor(primaryColor)}>
            Preview action
          </button>
          <span>Primary action preview</span>
        </div>
      </fieldset>
    </div>
  );
}

function hoursSummary(value: string, locale: string) {
  const fmt = (time: string) =>
    new Date(`2000-01-01T${time}:00`).toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  return parseHours(value)
    .map((d) =>
      d.closed
        ? `${d.day.slice(0, 3)} closed`
        : `${d.day.slice(0, 3)} ${fmt(d.opens)}–${fmt(d.closes)}${d.overnight ? " next day" : ""}`,
    )
    .join(" · ");
}
function validHours(value: string) {
  return parseHours(value).every(
    (d) =>
      d.closed ||
      (/^\d{2}:\d{2}$/.test(d.opens) &&
        /^\d{2}:\d{2}$/.test(d.closes) &&
        (d.overnight ? d.closes < d.opens : d.closes > d.opens)),
  );
}

function SetupWizard({
  categories,
  uiScale,
  onUiScaleChange,
  onDone,
}: {
  categories: Category[];
  uiScale: number;
  onUiScaleChange: (scale: number) => void;
  onDone: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<SetupInput>({
    name: "",
    organizationType: "Community center",
    phone: "",
    email: "",
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "United States",
    locationName: "Main location",
    operatingHours: JSON.stringify(defaultHours),
    locale: "en-US",
    dateFormat: "MMM d, yyyy",
    retentionDays: 30,
    requireVerification: true,
    allowAnonymousFinders: true,
    theme: "system",
    primaryColor: DEFAULT_BRAND_COLOR,
    logoDataUrl: null,
  });
  const update = (key: keyof SetupInput, value: string | number | boolean | null) =>
    setForm((f) => ({ ...f, [key]: value }));
  const complete = async () => {
    setBusy(true);
    setError("");
    try {
      await api.completeSetup(form);
      await onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const steps = [
    "Organization",
    "Location",
    "Operating hours",
    "Branding",
    "Preferences",
    "Review",
  ];
  return (
    <main
      className="setup-shell"
      data-theme={form.theme}
      style={
        {
          "--org-brand-color": form.primaryColor,
          "--reclaim-ui-scale": uiScale,
        } as React.CSSProperties
      }
    >
      <aside className="setup-aside">
        <div className="brand-lockup">
          <BrandLockup />
        </div>
        <div className="setup-aside-copy">
          <span className="eyebrow">A BETTER WAY TO KEEP THINGS FOUND</span>
          <h1>Good things find their way back.</h1>
          <p>
            A calm, local workspace for the things people leave behind — and the people looking for
            them.
          </p>
        </div>
        <div className="setup-aside-illustration">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="illustration-card">
            <span>
              <Package size={22} />
            </span>
            <div>
              <strong>Belonging, found.</strong>
              <small>Ready for its next chapter</small>
            </div>
            <Check size={17} />
          </div>
          <div className="floating-note">
            <Sparkles size={15} /> All together, all local
          </div>
        </div>
        <span className="setup-aside-foot">
          <ShieldCheck size={15} /> Private on this device
        </span>
      </aside>
      <section className="setup-content">
        <div className="setup-top-row">
          <div className="setup-step-top">
            <span className="eyebrow">WORKSPACE SETUP</span>
            <span>
              STEP {step + 1} OF {steps.length}
            </span>
          </div>
          <UiSizeControl scale={uiScale} onChange={onUiScaleChange} />
        </div>
        <div className="step-progress" role="group" aria-label="Setup steps">
          {steps.map((label, i) => (
            <div
              key={label}
              role="group"
              aria-label={`Step ${i + 1}: ${label}`}
              aria-current={i === step ? "step" : undefined}
              className={i <= step ? "complete" : ""}
            >
              <i />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="setup-form-content">
          {step === 0 && (
            <>
              <span className="eyebrow">LET’S START WITH THE BASICS</span>
              <h1>Who are we setting up?</h1>
              <p>We’ll use this to make your workspace feel like yours.</p>
              <DevAutofill
                scenario="organization"
                onFill={(values) => setForm((f) => ({ ...f, ...values }))}
              />
              <Field label="Organization name" required>
                <input
                  autoFocus
                  placeholder="e.g. Northside Community Center"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field label="Organization type">
                <SelectMenu
                  ariaLabel="Organization type"
                  value={form.organizationType}
                  onChange={(value) => update("organizationType", value)}
                  options={[
                    "Community center",
                    "School or university",
                    "Gym or fitness facility",
                    "Library",
                    "Church or religious facility",
                    "Sports complex or pool",
                    "Event venue",
                    "Hotel or hospitality",
                    "Municipal building",
                    "Park or visitor center",
                    "Nonprofit",
                    "Other",
                  ].map((v) => ({ value: v, label: v }))}
                />
              </Field>
              <div className="form-grid two">
                <Field label="Primary phone">
                  <input
                    placeholder="(555) 010-2040"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </Field>
                <Field label="Email address">
                  <input
                    type="email"
                    placeholder="hello@organization.org"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <span className="eyebrow">WHERE YOU OPERATE</span>
              <h1>Set up your first location</h1>
              <p>Add the primary site people visit to find and drop off items.</p>
              <Field label="Location name" required>
                <input
                  autoFocus
                  placeholder="Main building"
                  value={form.locationName}
                  onChange={(e) => update("locationName", e.target.value)}
                  required
                />
              </Field>
              <Field label="Street address">
                <input
                  placeholder="123 Main Street"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                />
              </Field>
              <div className="form-grid two">
                <Field label="City">
                  <input value={form.city} onChange={(e) => update("city", e.target.value)} />
                </Field>
                <Field label="State or region">
                  <input value={form.region} onChange={(e) => update("region", e.target.value)} />
                </Field>
                <Field label="Postal code">
                  <input
                    value={form.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                  />
                </Field>
                <Field label="Country">
                  <input value={form.country} onChange={(e) => update("country", e.target.value)} />
                </Field>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <span className="eyebrow">WHEN YOU OPERATE</span>
              <h1>Set your operating hours</h1>
              <p>When can people reach your team? Adjust each day individually.</p>
              <HoursEditor
                value={form.operatingHours}
                onChange={(value) => update("operatingHours", value)}
                locale={form.locale}
              />
            </>
          )}
          {step === 3 && (
            <>
              <span className="eyebrow">BRANDING &amp; APPEARANCE</span>
              <h1>Make this workspace yours</h1>
              <p>Choose the look staff will see each day.</p>
              <div className="setup-theme-picker">
                <span className="field-label">Workspace appearance</span>
                <ThemeRadioGroup
                  className="compact-theme-options"
                  label="Workspace theme"
                  value={form.theme}
                  onChange={(theme) => setForm((f) => ({ ...f, theme }))}
                  choices={[
                    ["light", "Light"],
                    ["dark", "Dark"],
                    ["system", "Follow System"],
                  ]}
                />
              </div>
              <LogoAndColor
                primaryColor={form.primaryColor}
                logoDataUrl={form.logoDataUrl}
                onColor={(value) => update("primaryColor", value)}
                onLogo={(value) => update("logoDataUrl", value)}
              />
            </>
          )}
          {step === 4 && (
            <>
              <span className="eyebrow">OPERATIONAL PREFERENCES</span>
              <h1>Set your defaults</h1>
              <p>Choose the retention and return rules staff will use.</p>
              <div className="preference-card">
                <div className="preference-symbol">
                  <Clock3 size={17} />
                </div>
                <div>
                  <strong>Default retention period</strong>
                  <small>Time to hold an item before a staff review.</small>
                </div>
                <label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={form.retentionDays}
                    onChange={(e) => update("retentionDays", Number(e.target.value))}
                  />{" "}
                  days
                </label>
              </div>
              <label className="behavior-choice">
                <span className="choice-check">
                  {form.requireVerification && <Check size={13} />}
                </span>
                <span>
                  <strong>Require ownership verification for returns</strong>
                  <small>Staff document how an item was verified.</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.requireVerification}
                  onChange={(e) => update("requireVerification", e.target.checked)}
                />
              </label>
              <label className="behavior-choice">
                <span className="choice-check">
                  {form.allowAnonymousFinders && <Check size={13} />}
                </span>
                <span>
                  <strong>Allow anonymous finders</strong>
                  <small>Contact details stay optional.</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.allowAnonymousFinders}
                  onChange={(e) => update("allowAnonymousFinders", e.target.checked)}
                />
              </label>
              <div className="form-grid two">
                <Field label="Locale">
                  <SelectMenu
                    ariaLabel="Locale"
                    value={form.locale}
                    onChange={(value) => update("locale", value)}
                    options={[
                      { value: "en-US", label: "English (United States)" },
                      { value: "en-GB", label: "English (United Kingdom)" },
                      { value: "en-CA", label: "English (Canada)" },
                    ]}
                  />
                </Field>
                <Field label="Date format">
                  <SelectMenu
                    ariaLabel="Date format"
                    value={form.dateFormat}
                    onChange={(value) => update("dateFormat", value)}
                    options={["MMM d, yyyy", "dd/MM/yyyy", "MM/dd/yyyy"].map((v) => ({
                      value: v,
                      label: v,
                    }))}
                  />
                </Field>
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <span className="eyebrow">READY WHEN YOU ARE</span>
              <h1>Review your workspace</h1>
              <p>Everything can be updated later. Here’s what we’ll get ready.</p>
              <div className="review-card">
                <div className="review-top">
                  <div className="workspace-avatar large-avatar">{initials(form.name)}</div>
                  <div>
                    <strong>{form.name || "Your organization"}</strong>
                    <span>{form.organizationType}</span>
                  </div>
                </div>
                <div className="review-details">
                  <span>
                    <MapPin size={15} />
                    {[form.locationName, form.city, form.region].filter(Boolean).join(" · ") ||
                      "First location"}
                  </span>
                  {form.phone && (
                    <span>
                      <UserRound size={15} />
                      {form.phone}
                    </span>
                  )}
                  {form.email && (
                    <span>
                      <CircleHelp size={15} />
                      {form.email}
                    </span>
                  )}
                  <span>
                    <Clock3 size={15} />
                    {hoursSummary(form.operatingHours, form.locale)}
                  </span>
                  <span>
                    {form.retentionDays} day default · ownership verification{" "}
                    {form.requireVerification ? "required" : "optional"}
                  </span>
                  <span>
                    Appearance ·{" "}
                    {form.theme === "system"
                      ? "Follow System"
                      : form.theme[0].toUpperCase() + form.theme.slice(1)}
                  </span>
                </div>
              </div>
              <div className="setup-includes">
                <span className="section-kicker">INCLUDED FROM DAY ONE</span>
                <div>
                  <span>
                    <Check size={14} /> 17 ready-to-use categories
                  </span>
                  <span>
                    <Check size={14} /> Front desk, cabinet &amp; secure drawer
                  </span>
                  <span>
                    <Check size={14} /> Private local database
                  </span>
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="inline-alert" role="alert">
              <CircleHelp size={15} />
              {error}
            </div>
          )}
        </div>
        <div className="setup-footer">
          <button
            className="button button-quiet"
            onClick={() => (step ? setStep(step - 1) : null)}
            disabled={step === 0 || busy}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <span>
            {step < 5
              ? "You can fine-tune this later."
              : `${categories.length} categories will be ready.`}
          </span>
          {step < 5 ? (
            <button
              className="button button-primary"
              disabled={
                (step === 0 && !form.name.trim()) ||
                (step === 1 && !form.locationName.trim()) ||
                (step === 2 && !validHours(form.operatingHours)) ||
                (step === 3 && !accessibleBrandColor(form.primaryColor))
              }
              onClick={() => setStep(step + 1)}
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="button button-primary"
              disabled={busy || !form.name.trim() || !accessibleBrandColor(form.primaryColor)}
              onClick={() => void complete()}
            >
              {busy ? "Setting up…" : "Open my workspace"}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function PhotoUploadButton({ onPhoto }: { onPhoto: (dataUrl: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        className="photo-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose item photo"
        tabIndex={-1}
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          if (file.size > 15 * 1024 * 1024) {
            await messageDialog("Choose an image smaller than 15 MB.", {
              title: "Photo too large",
              kind: "error",
            });
            input.value = "";
            return;
          }
          try {
            onPhoto(await readFileDataUrl(file));
          } catch (error) {
            await messageDialog(String(error), { title: "Could not read photo", kind: "error" });
          }
          input.value = "";
        }}
      />
      <button
        className="button button-secondary"
        type="button"
        onClick={() => ref.current?.click()}
      >
        Add photo <Plus size={14} />
      </button>
    </>
  );
}
function FoundForm({
  item,
  categories,
  locations,
  busy,
  onSubmit,
}: {
  item?: FoundItem;
  categories: Category[];
  locations: StorageLocation[];
  busy: boolean;
  onSubmit: (input: FoundInput, photoPath: string | null) => void;
}) {
  const initial: FoundInput = item
    ? {
        name: item.name,
        categoryId: item.categoryId,
        description: item.description,
        color: item.color,
        brand: item.brand,
        foundAt: item.foundAt.slice(0, 16),
        foundLocation: item.foundLocation,
        storageLocationId: item.storageLocationId,
        finderName: item.finderName,
        finderContact: item.finderContact,
        staffNotes: item.staffNotes,
      }
    : {
        name: "",
        categoryId: categories.find((c) => c.active)?.id || "other",
        description: "",
        color: "",
        brand: "",
        foundAt: nowLocal(),
        foundLocation: "",
        storageLocationId: locations.find((l) => l.active)?.id || "",
        finderName: "",
        finderContact: "",
        staffNotes: "",
      };
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FoundInput>(initial);
  const set = (key: keyof FoundInput, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form, photoPath);
      }}
    >
      {!item && (
        <DevAutofill
          scenario="found"
          onFill={(values, scenario) =>
            setForm((f) => ({
              ...f,
              ...values,
              categoryId: categories.find((c) => c.id === "drinkware")?.id || f.categoryId,
              ...(scenario === "secure-storage"
                ? { storageLocationId: locations.find((l) => l.active && l.secure)?.id || "" }
                : {}),
            }))
          }
        />
      )}
      <div className="form-grid two">
        <Field label="Item name" required>
          <input
            autoFocus
            placeholder="e.g. Navy blue water bottle"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            maxLength={160}
          />
        </Field>
        <Field label="Category" required>
          <SelectMenu
            ariaLabel="Category"
            value={form.categoryId}
            onChange={(value) => set("categoryId", value)}
            options={categories
              .filter((c) => c.active || c.id === form.categoryId)
              .map((c) => ({
                value: c.id,
                label: c.name + (c.active ? "" : " · Archived"),
                disabled: !c.active,
              }))}
          />
        </Field>
        <Field label="Color">
          <input
            placeholder="Blue"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
          />
        </Field>
        <Field label="Brand">
          <input
            placeholder="Optional"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
          />
        </Field>
        <Field label="Date &amp; time found" required>
          <input
            type="datetime-local"
            value={form.foundAt}
            onChange={(e) => set("foundAt", e.target.value)}
            required
          />
        </Field>
        <Field label="Found at">
          <input
            placeholder="e.g. Pool changing room"
            value={form.foundLocation}
            onChange={(e) => set("foundLocation", e.target.value)}
          />
        </Field>
        <Field label="Storage location" required>
          <SelectMenu
            ariaLabel="Storage location"
            value={form.storageLocationId}
            onChange={(value) => set("storageLocationId", value)}
            placeholder="Choose a storage location"
            options={locations
              .filter((l) => l.active)
              .map((l) => ({ value: l.id, label: l.name + (l.secure ? " · Secure" : "") }))}
          />
        </Field>
        <div className="secure-hint">
          <ShieldCheck size={15} />
          <span>Items in secure locations will need a documented verification before return.</span>
        </div>
        <Field label="Description" className="span-two">
          <textarea
            rows={2}
            placeholder="Distinctive marks, contents, or other useful details"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Finder name (optional)">
          <input
            placeholder="Leave blank for anonymous"
            value={form.finderName}
            onChange={(e) => set("finderName", e.target.value)}
          />
        </Field>
        <Field label="Finder contact">
          <input
            placeholder="Phone or email"
            value={form.finderContact}
            onChange={(e) => set("finderContact", e.target.value)}
          />
        </Field>
        <Field label="Staff notes" className="span-two">
          <textarea
            rows={2}
            placeholder="Internal notes for your team"
            value={form.staffNotes}
            onChange={(e) => set("staffNotes", e.target.value)}
          />
        </Field>
      </div>
      {!item && (
        <div className="photo-placeholder">
          <input
            ref={photoInput}
            className="photo-file-input"
            type="file"
            tabIndex={-1}
            accept="image/png,image/jpeg,image/webp"
            aria-label="Choose item photo"
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              if (file.size > 15 * 1024 * 1024) {
                await messageDialog("Choose an image smaller than 15 MB.", {
                  title: "Photo too large",
                  kind: "error",
                });
                input.value = "";
                return;
              }
              try {
                setPhotoPath(await readFileDataUrl(file));
              } catch (error) {
                await messageDialog(String(error), {
                  title: "Could not read photo",
                  kind: "error",
                });
              }
              input.value = "";
            }}
          />
          {photoPath ? (
            <>
              <img
                className="photo-selected-preview"
                src={photoPath}
                alt="Selected item photo preview"
              />
              <div>
                <strong>Photo selected</strong>
                <small>Attached to this item</small>
              </div>
              <button
                type="button"
                className="button button-quiet button-small"
                onClick={() => setPhotoPath(null)}
              >
                Remove photo
              </button>
            </>
          ) : (
            <>
              <span>
                <Plus size={17} />
              </span>
              <div>
                <strong>Add item photo</strong>
                <small>PNG, JPEG, or WebP · up to 15 MB</small>
              </div>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => photoInput.current?.click()}
              >
                Choose photo
              </button>
            </>
          )}
        </div>
      )}
      <div className="modal-footer">
        <span>
          <span className="required-dot">*</span> Required fields
        </span>
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || !form.name.trim() || !form.storageLocationId}
        >
          {busy ? "Saving…" : item ? "Save changes" : "Save found item"}
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
function LostForm({
  report,
  categories,
  busy,
  onSubmit,
}: {
  report?: LostReport;
  categories: Category[];
  busy: boolean;
  onSubmit: (input: LostInput) => void;
}) {
  const [form, setForm] = useState<LostInput>(
    report
      ? {
          name: report.name,
          categoryId: report.categoryId,
          description: report.description,
          color: report.color,
          brand: report.brand,
          lostAt: report.lostAt.slice(0, 16),
          lastLocation: report.lastLocation,
          claimantName: report.claimantName,
          contact: report.contact,
          notes: report.notes,
        }
      : {
          name: "",
          categoryId: categories.find((c) => c.active)?.id || "other",
          description: "",
          color: "",
          brand: "",
          lostAt: nowLocal(),
          lastLocation: "",
          claimantName: "",
          contact: "",
          notes: "",
        },
  );
  const set = (key: keyof LostInput, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      {!report && (
        <DevAutofill
          scenario="lost"
          onFill={(values) =>
            setForm((f) => ({
              ...f,
              ...values,
              categoryId: typeof values.categoryId === "string" ? values.categoryId : f.categoryId,
            }))
          }
        />
      )}
      <div className="form-grid two">
        <Field label="Item name" required>
          <input
            autoFocus
            value={form.name}
            placeholder="What are they looking for?"
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </Field>
        <Field label="Category" required>
          <SelectMenu
            ariaLabel="Category"
            value={form.categoryId}
            onChange={(value) => set("categoryId", value)}
            options={categories
              .filter((c) => c.active || c.id === form.categoryId)
              .map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Color">
          <input
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
            placeholder="Color"
          />
        </Field>
        <Field label="Brand">
          <input
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Approx. date lost" required>
          <input
            type="datetime-local"
            value={form.lostAt}
            onChange={(e) => set("lostAt", e.target.value)}
            required
          />
        </Field>
        <Field label="Last known location">
          <input
            value={form.lastLocation}
            onChange={(e) => set("lastLocation", e.target.value)}
            placeholder="Where they last saw it"
          />
        </Field>
        <Field label="Claimant name" required>
          <input
            value={form.claimantName}
            onChange={(e) => set("claimantName", e.target.value)}
            required
          />
        </Field>
        <Field label="Contact information">
          <input
            value={form.contact}
            onChange={(e) => set("contact", e.target.value)}
            placeholder="Phone or email"
          />
        </Field>
        <Field label="Description" className="span-two">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Anything distinctive?"
          />
        </Field>
        <Field label="Notes" className="span-two">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Internal notes"
          />
        </Field>
      </div>
      <div className="modal-footer">
        <span>
          <span className="required-dot">*</span> Required fields
        </span>
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || !form.name.trim() || !form.claimantName.trim()}
        >
          {busy ? "Saving…" : report ? "Save changes" : "Save lost report"}
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
function CategoryForm({
  category,
  busy,
  onSubmit,
}: {
  category?: Category;
  busy: boolean;
  onSubmit: (input: {
    id?: string;
    name: string;
    description: string;
    icon: string;
    retentionDays: number | null;
  }) => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [icon, setIcon] = useState(category?.icon || "Package");
  const [retention, setRetention] = useState(category?.retentionDays?.toString() || "");
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: category?.id,
          name,
          description,
          icon,
          retentionDays: retention ? Number(retention) : null,
        });
      }}
    >
      <Field label="Category name" required>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Musical instruments"
        />
      </Field>
      <div className="form-grid two">
        <Field label="Icon">
          <SelectMenu
            ariaLabel="Icon"
            value={icon}
            onChange={setIcon}
            options={ICON_CHOICES.map(({ value, label }) => ({
              value,
              label,
              icon: iconMap[value],
            }))}
          />
        </Field>
        <Field label="Retention override">
          <input
            type="number"
            min="1"
            max="3650"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            placeholder="Use organization default"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Help staff decide what belongs here"
        />
      </Field>
      <div className="modal-footer">
        <span>Existing item records keep their category.</span>
        <button className="button button-primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : category ? "Save category" : "Create category"}
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
function StorageForm({
  location,
  locations,
  busy,
  onSubmit,
}: {
  location?: StorageLocation;
  locations: StorageLocation[];
  busy: boolean;
  onSubmit: (input: {
    id?: string;
    name: string;
    description: string;
    parentId: string | null;
    secure: boolean;
    organizationLocationId: string | null;
  }) => void;
}) {
  const [name, setName] = useState(location?.name || "");
  const [description, setDescription] = useState(location?.description || "");
  const [parentId, setParentId] = useState(location?.parentId || "");
  const [secure, setSecure] = useState(location?.secure || false);
  const [siteId, setSiteId] = useState(location?.organizationLocationId || "");
  const [sites, setSites] = useState<OrganizationLocation[]>([]);
  const [siteError, setSiteError] = useState("");
  useEffect(() => {
    let live = true;
    void api
      .listOrganizationLocations(false)
      .then((items) => {
        if (live) setSites(items);
      })
      .catch((error) => {
        if (live) setSiteError(String(error));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: location?.id,
          name,
          description,
          parentId: parentId || null,
          secure,
          organizationLocationId: siteId || null,
        });
      }}
    >
      <Field label="Location name" required>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Cabinet · Shelf A"
        />
      </Field>
      <Field label="Organization site">
        <SelectMenu
          ariaLabel="Organization site"
          value={siteId}
          onChange={setSiteId}
          placeholder="No site assigned"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
        />
      </Field>
      {siteError && (
        <div className="settings-note" role="alert">
          Could not load organization sites: {siteError}
        </div>
      )}
      <Field label="Inside another storage location">
        <SelectMenu
          ariaLabel="Inside another storage location"
          value={parentId}
          onChange={setParentId}
          placeholder="No parent location"
          options={locations
            .filter((l) => l.active && l.id !== location?.id)
            .map((l) => ({ value: l.id, label: l.name }))}
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details for staff"
        />
      </Field>
      <label className="secure-toggle">
        <span className="secure-toggle-icon">
          <ShieldCheck size={17} />
        </span>
        <span>
          <strong>Secure storage</strong>
          <small>Requires ownership verification before a return.</small>
        </span>
        <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
      </label>
      <div className="modal-footer">
        <span>Hierarchies can be updated later.</span>
        <button className="button button-primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : location ? "Save changes" : "Add location"}
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}

function ItemDrawer({
  item,
  modalActive,
  staffName,
  locations,
  onClose,
  onEdit,
  onReturn,
  onDisposition,
  onMove,
}: {
  item: FoundItem;
  modalActive: boolean;
  staffName: string;
  locations: StorageLocation[];
  onClose: () => void;
  onEdit: () => void;
  onReturn: () => void;
  onDisposition: () => void;
  onMove: (id: string) => void;
}) {
  const drawerRef = useFocusTrap<HTMLDivElement>({ onClose, suspended: modalActive });
  const [events, setEvents] = useState<
    { id: string; eventType: string; happenedAt: string; staffName: string; details: string }[]
  >([]);
  const [photos, setPhotos] = useState<{ id: string; dataUrl: string }[]>([]);
  const [locationId, setLocationId] = useState(item.storageLocationId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const loadPhotos = useCallback(
    () =>
      api
        .itemPhotos(item.id)
        .then(setPhotos)
        .catch(() => setPhotos([])),
    [item.id],
  );
  useEffect(() => {
    void api
      .itemActivity("found_item", item.id)
      .then(setEvents)
      .catch(() => setEvents([]));
    void loadPhotos();
  }, [item.id, loadPhotos]);
  const eventTitle = (type: string) =>
    ({
      item_registered: "Added to inventory",
      item_updated: "Item details updated",
      item_moved: "Moved to a new location",
      item_returned: "Item returned",
      item_disposed: "Disposition recorded",
      match_reviewed: "Match reviewed",
    })[type] || type.replace(/_/g, " ");
  return (
    <>
      <button
        className="drawer-backdrop"
        tabIndex={-1}
        aria-label="Close item details"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className="item-drawer"
        role="dialog"
        aria-modal={modalActive ? undefined : true}
        aria-hidden={modalActive || undefined}
        aria-label={`Details for ${item.name}`}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <div className="drawer-top">
            <span className="eyebrow">FOUND ITEM</span>
            <button className="icon-button" aria-label="Close details" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="drawer-identity">
            {photos[0] ? (
              <img className="drawer-item-photo" src={photos[0].dataUrl} alt="" />
            ) : (
              <div className="drawer-item-icon">
                <ItemIcon categoryId={item.categoryId} />
              </div>
            )}
            <div className="drawer-title">
              <h2>{item.name}</h2>
              <p>
                {item.categoryName}
                {item.color ? ` · ${item.color}` : ""}
                {item.brand ? ` · ${item.brand}` : ""}
              </p>
              <div className="drawer-facts">
                <span className="ref-cell">{item.reference}</span>
                <StatusBadge status={item.status} />
              </div>
            </div>
          </div>
        </div>
        <div className="drawer-body">
          {photos.length > 0 && (
            <div className="photo-gallery">
              {photos.map((photo) => (
                <div className="stored-photo" key={photo.id}>
                  <img src={photo.dataUrl} alt={`Photo of ${item.name}`} />
                  <button
                    aria-label={`Remove photo of ${item.name}`}
                    onClick={() =>
                      void confirmDialog(
                        `Remove this photo of ${item.name} from the record? Its custody-history entry stays.`,
                        { title: "Remove photo", kind: "warning" },
                      ).then(async (ok) => {
                        if (!ok) return;
                        try {
                          await api.removePhoto(photo.id);
                          await loadPhotos();
                        } catch {
                          /* The photo list stays; reopening the drawer refetches. */
                        }
                      })
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="drawer-section">
            <span className="section-kicker">ITEM DETAILS</span>
            <Detail label="Description" value={item.description || "No description added"} />
            <Detail
              label="Found at"
              value={`${dateLabel(item.foundAt)}${item.foundLocation ? ` · ${item.foundLocation}` : ""}`}
            />
            <Detail
              label="Storage location"
              value={`${item.storageLocation}${item.storageSecure ? " · Secure" : ""}`}
            />
            <Detail label="Finder" value={item.finderName || "Anonymous"} />
            <Detail label="Contact" value={item.finderContact || "Not provided"} />
            <Detail label="Staff notes" value={item.staffNotes || "None"} />
          </div>
          <div className="drawer-timeline-wrap">
            <button
              type="button"
              className="drawer-history-toggle"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <span className="section-kicker">CUSTODY HISTORY</span>
              <span className="drawer-history-meta">
                <span className="history-count">{events.length || 1}</span>
                <ChevronDown size={15} />
              </span>
            </button>
            {historyOpen && (
              <div className="drawer-timeline">
                {events.length ? (
                  events.map((event) => (
                    <div className="timeline-entry" key={event.id}>
                      <i />
                      <div>
                        <strong>{eventTitle(event.eventType)}</strong>
                        <span>
                          {dateLabel(event.happenedAt)}
                          {event.staffName ? ` · ${event.staffName}` : ""}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="timeline-entry">
                    <i />
                    <div>
                      <strong>Added to inventory</strong>
                      <span>
                        {dateLabel(item.createdAt)} · by {staffName}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="drawer-foot">
          {item.status === "in_custody" ? (
            <>
              <div className="drawer-actions">
                <button className="button button-secondary" onClick={onEdit}>
                  Edit details
                </button>
                <PhotoUploadButton
                  onPhoto={async (dataUrl) => {
                    try {
                      await api.importPhoto(item.id, dataUrl);
                      await loadPhotos();
                    } catch (e) {
                      await messageDialog(String(e), {
                        title: "Could not add photo",
                        kind: "error",
                      });
                    }
                  }}
                />
              </div>
              <div className="drawer-move">
                <label className="field">
                  <span>Move to another location</span>
                  <div className="move-controls">
                    <SelectMenu
                      ariaLabel="New storage location"
                      value={locationId}
                      onChange={setLocationId}
                      options={locations
                        .filter((l) => l.active)
                        .map((l) => ({
                          value: l.id,
                          label: l.name + (l.secure ? " · Secure" : ""),
                        }))}
                    />
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => void onMove(locationId)}
                      disabled={locationId === item.storageLocationId}
                    >
                      Move
                    </button>
                  </div>
                </label>
              </div>
              <div className="drawer-actions">
                <button className="button button-secondary" onClick={onDisposition}>
                  Review disposition
                </button>
                <button className="button button-primary" onClick={onReturn}>
                  Start return <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <button className="button button-quiet drawer-action" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ReturnForm({
  item,
  reports,
  preselected,
  busy,
  required,
  onSubmit,
}: {
  item: FoundItem;
  reports: LostReport[];
  preselected: ConfirmedClaim | null;
  busy: boolean;
  required: boolean;
  onSubmit: (value: {
    foundItemId: string;
    lostReportId: string | null;
    recipientName: string;
    verificationMethod: string;
    verificationNote: string;
    staffNote: string;
  }) => void;
}) {
  const [recipientName, setRecipient] = useState("");
  const [lostReportId, setReport] = useState(preselected?.lostReportId ?? "");
  const [method, setMethod] = useState(required ? "description_confirmed" : "none");
  const [note, setNote] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const openReportOptions = reports
    .filter((r) => r.status === "open")
    .map((r) => ({ value: r.id, label: `${r.reference} · ${r.claimantName} · ${r.name}` }));
  // The adjudicated claim stays selectable even when the capped lost-report
  // list does not include it.
  if (
    preselected &&
    lostReportId === preselected.lostReportId &&
    !openReportOptions.some((o) => o.value === preselected.lostReportId)
  ) {
    openReportOptions.unshift({
      value: preselected.lostReportId,
      label: `${preselected.reference} · ${preselected.claimantName}`,
    });
  }
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          foundItemId: item.id,
          lostReportId: lostReportId || null,
          recipientName,
          verificationMethod: method,
          verificationNote: note,
          staffNote,
        });
      }}
    >
      <div className="return-item-summary">
        <Package size={17} />
        <span>
          <strong>{item.name}</strong>
          <small>
            {item.reference} · currently {item.storageLocation}
          </small>
        </span>
      </div>
      <Field label="Recipient name" required>
        <input
          autoFocus
          value={recipientName}
          onChange={(e) => setRecipient(e.target.value)}
          required
          placeholder="Who is receiving this item?"
        />
      </Field>
      <Field
        label="Related lost report"
        hint={
          preselected && lostReportId === preselected.lostReportId
            ? `Preselected from the confirmed claim for ${preselected.claimantName}. Choose another open report if this return matches a different one.`
            : undefined
        }
      >
        <SelectMenu
          ariaLabel="Related lost report"
          value={lostReportId}
          onChange={setReport}
          placeholder="No linked report"
          options={openReportOptions}
        />
      </Field>
      <div className="return-policy">
        <ShieldCheck size={15} />
        <span>
          {required
            ? "Verification is required by workspace policy or this secure storage location."
            : "Documenting how you confirmed ownership is recommended."}
        </span>
      </div>
      <Field label="Verification method" required={required}>
        <SelectMenu
          ariaLabel="Verification method"
          value={method}
          onChange={setMethod}
          options={[
            { value: "none", label: "Not recorded" },
            { value: "description_confirmed", label: "Item description confirmed" },
            { value: "purchase_evidence", label: "Receipt or purchase evidence reviewed" },
            { value: "photo_id_visual", label: "Photo ID visually checked" },
            { value: "other", label: "Other documented evidence" },
          ]}
        />
      </Field>
      <Field label="Verification reference or explanation" required={required}>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Briefly describe what was confirmed. Do not record ID numbers."
          required={required}
        />
      </Field>
      <Field label="Staff note">
        <textarea
          rows={2}
          value={staffNote}
          onChange={(e) => setStaffNote(e.target.value)}
          placeholder="Optional handoff details"
        />
      </Field>
      <div className="modal-footer">
        <span>This will end the custody record.</span>
        <button
          className="button button-primary"
          disabled={
            busy || !recipientName.trim() || (required && (!note.trim() || method === "none"))
          }
        >
          {busy ? "Saving…" : "Confirm return"}
          <Check size={15} />
        </button>
      </div>
    </form>
  );
}
function DispositionForm({
  item,
  busy,
  onSubmit,
}: {
  item: FoundItem;
  busy: boolean;
  onSubmit: (method: string) => void;
}) {
  const [method, setMethod] = useState("");
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(method);
      }}
    >
      <div className="return-item-summary">
        <Clock3 size={17} />
        <span>
          <strong>{item.name}</strong>
          <small>
            {item.reference} · {item.storageLocation}
          </small>
        </span>
      </div>
      <div className="return-policy">
        <CircleHelp size={15} />
        <span>
          Reclaim checks your configured retention deadline before saving. Eligibility asks for
          staff review; it does not imply local legal requirements.
        </span>
      </div>
      <Field label="Disposition method" required>
        <SelectMenu
          ariaLabel="Disposition method"
          value={method}
          onChange={setMethod}
          placeholder="Choose a method"
          options={[
            { value: "donated", label: "Donated" },
            { value: "recycled", label: "Recycled" },
            { value: "destroyed", label: "Destroyed" },
            { value: "transferred", label: "Transferred to another authority" },
            { value: "other", label: "Other documented method" },
          ]}
        />
      </Field>
      <div className="modal-footer">
        <span>The action is recorded in custody history.</span>
        <button className="button button-primary" disabled={busy || !method}>
          {busy ? "Saving…" : "Record disposition"}
          <Check size={15} />
        </button>
      </div>
    </form>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
/** Category records in scope, so icons resolve through the category's icon field. */
const CategoryIconContext = createContext<Category[]>([]);
/** Row/icon-tile glyph: the category's seeded icon rather than a name-pattern guess. */
function ItemIcon({ categoryId }: { categoryId: string }) {
  const categories = useContext(CategoryIconContext);
  const Icon =
    iconMap[categories.find((category) => category.id === categoryId)?.icon ?? ""] ?? Package;
  return <Icon size={17} strokeWidth={1.8} />;
}
function statusLabel(status: string): string {
  return status === "in_custody" ? "In custody" : status[0].toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  return (
    <span className={`status-badge ${status}`}>
      <i />
      {label}
    </span>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  actionIcon: ActionIcon = Plus,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: string;
  actionIcon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={22} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && (
        <button className="button button-secondary" onClick={onClick}>
          <ActionIcon size={15} />
          {action}
        </button>
      )}
    </div>
  );
}
function Field({
  label,
  required,
  children,
  className = "",
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <>
      <label className={`field ${className}`}>
        <span>
          {label}
          {required && <b> *</b>}
        </span>
        {children}
      </label>
      {hint && <p className="field-hint">{hint}</p>}
    </>
  );
}
function ModalFrame({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const ref = useFocusTrap<HTMLElement>({ onClose, labelId: titleId });
  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {children}
      </section>
    </div>
  );
}

export default App;
