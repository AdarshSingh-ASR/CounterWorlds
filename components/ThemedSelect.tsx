"use client";

import { ChevronDown } from "lucide-react";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type ThemedSelectOption = { value: string; label: string; disabled?: boolean };

export function ThemedSelect({ value, options, onChange, disabled = false, ariaLabel }: {
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);

  function choose(next: ThemedSelectOption) {
    if (!next.disabled) onChange(next.value);
    setOpen(false);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
    if (event.key === "Escape") setOpen(false);
  }

  return <div className="themed-select" ref={root}>
    <button type="button" className="themed-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={onTriggerKeyDown}>
      <span>{selected?.label}</span><ChevronDown aria-hidden="true" />
    </button>
    {open && <div id={listId} className="themed-select-menu" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} className={option.value === value ? "selected" : ""} onClick={() => choose(option)}>{option.label}</button>)}
    </div>}
  </div>;
}
