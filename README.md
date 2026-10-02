<div align="center">

# PSYMARIUX<br />DEVELOPER WORKSHOP

**A personal portfolio you can walk through.**

Stone walls, oak beams, a real project chest—and the code behind the room.

[Repository](https://github.com/nohint404/psy-portfolio) · [GitHub profile](https://github.com/nohint404) · [PsyStream](https://stream.psymariux.dev)

</div>

<p align="center">
  <img src="docs/readme/workshop.webp" alt="The developer workshop: a blue-skinned voxel character in a stone-and-oak room, among a crafting table, project chest, bed, redstone lamp and PsyStream poster." width="847" />
</p>

<p align="center"><sub>The room is the navigation: approach a workstation to open the real project, activity or contact panel.</sub></p>

---

## A portfolio with a point of view

I built my portfolio as a little Minecraft workshop rather than a row of software cards. Walk up to the project chest, crafting table, furnace, redstone lamp, message book or PsyStream poster; the character finds a clear route, interacts with the object and opens the matching panel. A labeled shelf keeps the same destinations easy to reach with a keyboard or on a phone. **Ctrl/Cmd+K** searches those destinations and the public repositories already on the page.

**Psymariux** is my developer identity. The portfolio uses **[@nohint404](https://github.com/nohint404)** as its GitHub data source.

### Inside the room

- A Three.js scene built from locally resolved Minecraft Java 1.21.4 models, with the verified PsyMariux skin, a working redstone lever and a hinged chest.
- Real public GitHub projects, repository details and recent activity; an explicit fork disclosure keeps upstream work separate from my own.
- [PsyStream](https://stream.psymariux.dev), my closed-source streaming project, shown as its own product—not passed off as a public repository.
- An optional, saveable shinobi sandbox hidden behind **sleep → wake → sleep**. Its authored village opens onto seeded, procedurally generated terrain, with quests, crafting, combat, farming and building.

<sub>The screenshot uses Minecraft game artwork and a personal skin. Their owners retain their rights; the repository’s AGPL-3.0 license does not relicense those assets. See the image and asset provenance.</sub>

## The quieter details

The room is not just a picture with hotspots. Each destination uses obstacle-aware routes from the character’s current position; the lever interaction reaches for its handle, grips, flips and releases it. The switch state persists when the panel closes. If WebGL cannot start, a captured room preview and the labeled object shelf remain available.

The optional game is a separate, full-screen Canvas experience. It starts with a fixed authored village, then streams deterministic terrain in all directions. Generated chunks are cached within a bound; player-made changes and discoveries are saved. Progress stays in the browser, with validated import/export rather than a server account.
