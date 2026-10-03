import { Archive } from "pixelarticons/react/Archive";
import { ArrowRight } from "pixelarticons/react/ArrowRight";
import { Check } from "pixelarticons/react/Check";
import { ChevronRight } from "pixelarticons/react/ChevronRight";
import { Close } from "pixelarticons/react/Close";
import { Code } from "pixelarticons/react/Code";
import { ExternalLink } from "pixelarticons/react/ExternalLink";
import { Fire } from "pixelarticons/react/Fire";
import { GitBranch } from "pixelarticons/react/GitBranch";
import { GitCommit } from "pixelarticons/react/GitCommit";
import { Github } from "pixelarticons/react/Github";
import { Mail } from "pixelarticons/react/Mail";
import { Moon } from "pixelarticons/react/Moon";
import { Sun } from "pixelarticons/react/Sun";
import { Search } from "pixelarticons/react/Search";
import { Play } from "pixelarticons/react/Play";
import { Pause } from "pixelarticons/react/Pause";
import { Star } from "pixelarticons/react/Star";
import { Terminal } from "pixelarticons/react/Terminal";
import { Volume2 } from "pixelarticons/react/Volume2";
import { VolumeX } from "pixelarticons/react/VolumeX";

const icons = { play: Play, pause: Pause, next: ChevronRight, archive: Archive, "arrow-right": ArrowRight, check: Check, "chevron-right": ChevronRight, close: Close, code: Code, "external-link": ExternalLink, fire: Fire, "git-branch": GitBranch, "git-commit": GitCommit, github: Github, mail: Mail, moon: Moon, sun: Sun, search: Search, star: Star, terminal: Terminal, "volume-2": Volume2, "volume-x": VolumeX };
export default function PixelIcon({ name, className = "" }: { name: string; className?: string }) {
  const Svg = icons[name as keyof typeof icons] || Code;
  return <Svg aria-hidden="true" focusable="false" className={`pixel-icon ${className}`} style={{ height: "auto", aspectRatio: "1 / 1" }} />;
}
