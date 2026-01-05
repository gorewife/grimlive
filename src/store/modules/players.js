const NEWPLAYER = {
  name: "",
  id: "",
  discord_id: null,
  connected: false,
  role: {},
  alignmentIndex: 0,
  reminders: [],
  isVoteless: false,
  hasTwoVotes: false,
  hasResponded: {},
  isDead: false,
  pronouns: "",
  isRevealed: false,
};

const state = () => ({
  players: [],
  npcs: [],
  bluffs: [{}, {}, {}],
});

const getters = {
  alive({ players }) {
    return players.filter((player) => !player.isDead).length;
  },
  nonTravellers({ players }) {
    const nonTravellers = players.filter(
      (player) => player.role.team !== "traveller",
    );
    return Math.min(nonTravellers.length, 15);
  },
  // calculate a Map of player => night order
  nightOrder({ players, npcs }, getters, rootState) {
    const edition = rootState.edition;
    const otherTravellers = rootState.otherTravellers;
    const firstNight = [];
    const otherNight = [];
    players.forEach(({ role }) => {
      role.firstNightInEdition = edition.firstNight
        ? otherTravellers.has(role.id)
          ? role.firstNight
            ? edition.firstNight.indexOf("dusk") + 1.2
            : 0
          : edition.firstNight.indexOf(role.id) + 1
        : role.firstNight;
      role.otherNightInEdition = edition.otherNight
        ? otherTravellers.has(role.id)
          ? role.otherNight
            ? edition.otherNight.indexOf("dusk") + 1.2
            : 0
          : edition.otherNight.indexOf(role.id) + 1
        : role.otherNight;
      if (role.firstNightInEdition && !firstNight.includes(role)) {
        firstNight.push(role);
      }
      if (role.otherNightInEdition && !otherNight.includes(role)) {
        otherNight.push(role);
      }
    });
    npcs.forEach((npc) => {
      npc.firstNightInEdition =
        edition.firstNight && edition.otherNight.includes(npc.id)
          ? edition.firstNight.indexOf(npc.id) + 1
          : edition.firstNight && npc.firstNight
            ? edition.firstNight.indexOf("dusk") + 1.1
            : npc.firstNight;
      npc.otherNightInEdition =
        edition.otherNight && edition.otherNight.includes(npc.id)
          ? edition.otherNight.indexOf(npc.id) + 1
          : edition.otherNight && npc.otherNight
            ? edition.otherNight.indexOf("dusk") + 1.1
            : npc.otherNight;
      if (npc.firstNightInEdition && !firstNight.includes(npc)) {
        firstNight.push(npc);
      }
      if (npc.otherNightInEdition && !otherNight.includes(npc)) {
        otherNight.push(npc);
      }
    });
    firstNight.sort((a, b) => a.firstNightInEdition - b.firstNightInEdition);
    otherNight.sort((a, b) => a.otherNightInEdition - b.otherNightInEdition);
    const nightOrder = new Map();
    players.forEach((player) => {
      const first = firstNight.indexOf(player.role) + 1;
      const other = otherNight.indexOf(player.role) + 1;
      nightOrder.set(player, { first, other });
    });
    npcs.forEach((role) => {
      const first = firstNight.indexOf(role) + 1;
      const other = otherNight.indexOf(role) + 1;
      nightOrder.set(role, { first, other });
    });
    return nightOrder;
  },
};

const actions = {
  randomize({ state, commit }) {
    const players = state.players
      .map((a) => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map((a) => a[1]);
    commit("set", players);
  },
  clearRoles({ state, commit, rootState }) {
    let players;
    if (rootState.session.isSpectator) {
      players = state.players.map((player) => {
        if (player.role.team !== "traveller") {
          player.role = {};
          player.alignmentIndex = 0;
        }
        player.reminders = [];
        return player;
      });
    } else {
      players = state.players.map(({ name, id, pronouns, connected }) => ({
        ...NEWPLAYER,
        name,
        id,
        pronouns,
        connected,
      }));
    }
    commit("set", players);
    commit("setBluff");
  },
};

const mutations = {
  clear(state) {
    state.players = [];
    state.bluffs = [{}, {}, {}];
  },
  set(state, players = []) {
    state.players = players;
  },
  /**
  The update mutation also has a property for isFromSockets
  this property can be added to payload object for any mutations
  then can be used to prevent infinite loops when a property is
  able to be set from multiple different sessions on websockets.
  An example of this is in the sendPlayerPronouns and _updatePlayerPronouns
  in socket.js.
   */
  update(state, { player, property, value }) {
    const index = state.players.indexOf(player);
    if (index >= 0) {
      state.players[index][property] = value;
      if (property === "role" && value) state.players[index].alignmentIndex = 0;
    }
  },
  add(state, name) {
    state.players.push({
      ...NEWPLAYER,
      name,
    });
  },
  remove(state, index) {
    state.players.splice(index, 1);
  },
  swap(state, [from, to]) {
    const temp = state.players[from];
    state.players[from] = state.players[to];
    state.players[to] = temp;
  },
  move(state, [from, to]) {
    state.players.splice(to, 0, state.players.splice(from, 1)[0]);
  },
  setBluff(state, { index, role } = {}) {
    if (index !== undefined) {
      state.bluffs.splice(index, 1, role);
    } else {
      state.bluffs = [{}, {}, {}];
    }
  },
  setNpcs(state, { index, npcs } = {}) {
    if (index !== undefined) {
      state.npcs.splice(index, 1);
    } else if (npcs) {
      if (!Array.isArray(npcs)) {
        state.npcs.push(npcs);
      } else {
        state.npcs = npcs;
      }
    } else {
      state.npcs = [];
    }
  },
  resetReveals(state) {
    state.players.forEach((player) => {
      player.isRevealed = false;
    });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
