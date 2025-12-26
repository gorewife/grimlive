/**
 * Handle a vote request.
 * If the vote is from a seat that is already locked, ignore it.
 * @param state session state
 * @param index seat of the player in the circle
 * @param vote number of votes
 */
const handleVote = (state, [index, vote]) => {
  if (!state.nomination) return;
  state.votes = [...state.votes];
  state.votes[index] =
    vote === undefined ? Math.abs(state.votes[index] - 1) : vote;
};

const state = () => ({
  sessionId: "",
  isSpectator: false,
  isReconnecting: false,
  playerCount: 0,
  ping: 0,
  playerId: "",
  claimedSeat: -1,
  nomination: false,
  votes: [],
  lockedVote: 0,
  votingSpeed: 1000,
  allowSelfNaming: true,
  isVoteInProgress: false,
  voteHistory: [],
  markedPlayer: -1,
  isVoteHistoryAllowed: true,
  isVoteWatchingAllowed: true,
  isTwoVotesEnabled: false,
  isRolesDistributed: false,
  messages: [],
  timer: {
    isActive: false,
    duration: 0,
    endTime: null,
    startedBy: null,
    isPaused: false,
    pausedTime: null,
    pausedRemaining: 0,
  },
});

const getters = {};

const actions = {};

// mutations helper functions
const set = (key) => (state, val) => {
  state[key] = val;
};

const mutations = {
  setPlayerId: set("playerId"),
  setPlayerSecret: set("playerSecret"),
  setSpectator: set("isSpectator"),
  setReconnecting: set("isReconnecting"),
  setPlayerCount: set("playerCount"),
  setPing: set("ping"),
  setVotingSpeed: set("votingSpeed"),
  setVoteInProgress: set("isVoteInProgress"),
  setMarkedPlayer: set("markedPlayer"),
  setNomination: set("nomination"),
  setAllowSelfNaming: set("allowSelfNaming"),
  setVoteHistoryAllowed: set("isVoteHistoryAllowed"),
  setVoteWatchingAllowed: set("isVoteWatchingAllowed"),
  setTwoVotesEnabled: set("isTwoVotesEnabled"),
  claimSeat: set("claimedSeat"),
  distributeRoles: set("isRolesDistributed"),
  setSessionId(state, sessionId) {
    state.sessionId = sessionId
      .toLocaleLowerCase()
      .replace(/[^0-9a-z]/g, "")
      .substr(0, 10);
  },
  nomination(
    state,
    { nomination, votes, votingSpeed, lockedVote, isVoteInProgress } = {},
  ) {
    state.nomination = nomination || false;
    state.votes = votes || [];
    state.votingSpeed = votingSpeed || state.votingSpeed;
    state.lockedVote = lockedVote || 0;
    state.isVoteInProgress = isVoteInProgress || false;
  },
  /**
   * Create an entry in the vote history log. Requires current player array because it might change later in the game.
   * Only stores votes that were completed.
   * @param state
   * @param players
   */
  addHistory(state, players) {
    if (!state.isVoteHistoryAllowed && state.isSpectator) return;
    if (!state.nomination || state.lockedVote <= players.length) return;
    const isExile = players[state.nomination[1]].role.team === "traveller";
    const votes = [];
    for (var i = 0; i < players.length; i++) {
      for (var j = 0; j < state.votes[i]; j++) {
        votes.push(players[i].name);
      }
    }

    state.voteHistory.push({
      timestamp: new Date(),
      nominator: players[state.nomination[0]].name,
      nominee: players[state.nomination[1]].name,
      type: isExile ? "Exile" : "Execution",
      majority: Math.ceil(
        players.filter((player) => !player.isDead || isExile).length / 2,
      ),
      votes: votes,
    });
  },
  clearVoteHistory(state) {
    state.voteHistory = [];
  },
  /**
   * Store a vote with and without syncing it to the live session.
   * This is necessary in order to prevent infinite voting loops.
   * @param state
   * @param vote
   */
  vote: handleVote,
  voteSync: handleVote,
  lockVote(state, lock) {
    state.lockedVote = lock !== undefined ? lock : state.lockedVote + 1;
  },
  startTimer(state, { duration, endTime, startedBy }) {
    state.timer.isActive = true;
    state.timer.duration = duration;
    state.timer.endTime = endTime;
    state.timer.startedBy = startedBy;
  },
  stopTimer(state) {
    state.timer.isActive = false;
    state.timer.duration = 0;
    state.timer.endTime = null;
    state.timer.startedBy = null;
    state.timer.isPaused = false;
    state.timer.pausedTime = null;
    state.timer.pausedRemaining = 0;
  },
  pauseTimer(state) {
    if (!state.timer.isActive || state.timer.isPaused) return;
    const remaining = Math.max(0, Math.floor((state.timer.endTime - Date.now()) / 1000));
    state.timer.isPaused = true;
    state.timer.pausedTime = Date.now();
    state.timer.pausedRemaining = remaining;
  },
  resumeTimer(state) {
    if (!state.timer.isActive || !state.timer.isPaused) return;
    const newEndTime = Date.now() + (state.timer.pausedRemaining * 1000);
    state.timer.endTime = newEndTime;
    state.timer.isPaused = false;
    state.timer.pausedTime = null;
  },
  updateTimer(state, { endTime }) {
    state.timer.endTime = endTime;
  },
  syncTimer(state, timerData) {
    Object.assign(state.timer, timerData);
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
