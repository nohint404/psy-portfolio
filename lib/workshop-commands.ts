export type WorkshopCommand = { id: string; label: string; detail: string; keywords: string; art: string; run: () => void };
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function findCommands(commands: WorkshopCommand[], query: string) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return commands.filter(command => { const haystack = normalize(`${command.label} ${command.detail} ${command.keywords}`); return words.every(word => haystack.includes(word)); });
}
