"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { findCommands, type WorkshopCommand } from "@/lib/workshop-commands";
import PixelIcon from "./PixelIcon";

export default function QuickNavigate({ open, onOpenChange, commands, trigger }: { open: boolean; onOpenChange: (open: boolean) => void; commands: WorkshopCommand[]; trigger: RefObject<HTMLButtonElement | null> }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null), results = useRef<HTMLElement>(null), pending = useRef<WorkshopCommand | null>(null);
  useEffect(() => { if (open) pending.current = null; }, [open]);
  const found = findCommands(commands, query);
  const choose = (command: WorkshopCommand) => { pending.current = command; onOpenChange(false); };
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" />
    <Dialog.Content className="workshop-dialog quick-navigation" onOpenAutoFocus={event => { event.preventDefault(); setQuery(""); input.current?.focus(); }} onCloseAutoFocus={event => {
      event.preventDefault(); trigger.current?.focus();
      const command = pending.current; pending.current = null; command?.run();
    }} onEscapeKeyDown={event => { if (event.isComposing) event.preventDefault(); }} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = Array.from(results.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      if (!buttons.length) return;
      event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[index < 0 ? event.key === "ArrowDown" ? 0 : buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }}>
      <div className="dialog-top"><Dialog.Title>Where to?</Dialog.Title><Dialog.Close className="icon-button" aria-label="Close quick navigation"><PixelIcon name="close" /></Dialog.Close></div>
      <Dialog.Description className="sr-only">Search room objects, sections and public projects. Use the arrow keys to pick a result, Enter to go and Escape to close.</Dialog.Description>
      <div className="command-search"><PixelIcon name="search" /><input ref={input} aria-label="Search the workshop" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && found[0]) { event.preventDefault(); choose(found[0]); } }} placeholder="PsyStream, projects, Rust…" autoComplete="off" autoCorrect="off" spellCheck={false} /></div>
      <p className="command-count" role="status">{found.length} {found.length === 1 ? "destination" : "destinations"}</p>
      <nav ref={results} className="command-results" aria-label="Matching destinations">
        {found.map(command => <button key={command.id} onClick={() => choose(command)}><img src={command.art} width="36" height="36" alt="" aria-hidden="true" /><span><strong>{command.label}</strong><small>{command.detail}</small></span><PixelIcon name="arrow-right" /></button>)}
        {!found.length && <div className="command-empty"><p>No destination matches that search.</p><button className="text-button" onClick={() => { setQuery(""); input.current?.focus(); }}>Clear search</button></div>}
      </nav>
      <p className="command-hint">Search locally. Room destinations use the same walking routes.</p>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
