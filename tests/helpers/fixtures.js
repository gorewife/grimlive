/**
 * Test helpers and fixtures for integration tests
 */

export const mockCharacters = {
  washerwoman: { id: "washerwoman", name: "Washerwoman", team: "townsfolk", ability: "You start knowing that 1 of 2 players is a particular Townsfolk." },
  librarian: { id: "librarian", name: "Librarian", team: "townsfolk", ability: "You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)" },
  investigator: { id: "investigator", name: "Investigator", team: "townsfolk", ability: "You start knowing that 1 of 2 players is a particular Minion." },
  chef: { id: "chef", name: "Chef", team: "townsfolk", ability: "You start knowing how many pairs of evil players there are." },
  empath: { id: "empath", name: "Empath", team: "townsfolk", ability: "Each night, you learn how many of your 2 alive neighbours are evil." },
  fortuneteller: { id: "fortuneteller", name: "Fortune Teller", team: "townsfolk", ability: "Each night, choose 2 players: you learn if either is a Demon. There is a good player that registers as a Demon to you." },
  butler: { id: "butler", name: "Butler", team: "outsider", ability: "Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too." },
  drunk: { id: "drunk", name: "Drunk", team: "outsider", ability: "You do not know you are the Drunk. You think you are a Townsfolk character, but you are not." },
  poisoner: { id: "poisoner", name: "Poisoner", team: "minion", ability: "Each night, choose a player: they are poisoned tonight and tomorrow day." },
  spy: { id: "spy", name: "Spy", team: "minion", ability: "Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead." },
  scarletwoman: { id: "scarletwoman", name: "Scarlet Woman", team: "minion", ability: "If there are 5 or more players alive & the Demon dies, you become the Demon." },
  imp: { id: "imp", name: "Imp", team: "demon", ability: "Each night*, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp." }
};

export function createMockGrimoire(playerCount = 7) {
  const roles = [
    mockCharacters.washerwoman,
    mockCharacters.librarian,
    mockCharacters.investigator,
    mockCharacters.chef,
    mockCharacters.empath,
    mockCharacters.butler,
    mockCharacters.drunk,
    mockCharacters.poisoner,
    mockCharacters.spy,
    mockCharacters.scarletwoman,
    mockCharacters.imp
  ].slice(0, playerCount);
  
  return {
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `player-${String(i + 1).padStart(3, '0')}`,
      name: `Player ${i + 1}`,
      pronouns: ['she/her', 'he/him', 'they/them'][i % 3],
      role: null,
      reminders: [],
      isDead: false,
      isVoteless: false,
      hasGhostVote: false
    })),
    edition: { id: "tb", name: "Trouble Brewing" },
    isPublic: true,
    isNightOrder: false,
    isMenuOpen: false
  };
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
