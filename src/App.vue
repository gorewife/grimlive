<template>
  <div
    id="app"
    @keyup="keyup"
    tabindex="-1"
    role="application"
    aria-label="Grim Online Grimoire"
    :class="{
      night: grimoire.isNight,
      static: grimoire.isStatic,
    }"
    :style="{
      backgroundImage: grimoire.background
        ? `url('${grimoire.background}')`
        : '',
    }"
  >
    <video
      id="background"
      v-if="grimoire.background && grimoire.background.match(/\.(mp4|webm)$/i)"
      :src="grimoire.background"
      autoplay
      loop
      aria-hidden="true"
    ></video>
    <div class="backdrop" aria-hidden="true"></div>
    <transition name="blur" mode="out-in">
      <Intro v-if="!players.length" key="intro"></Intro>
      <TownInfo
        v-else-if="players.length && !session.nomination"
        key="towninfo"
      ></TownInfo>
      <Vote v-else key="vote" ref="vote"></Vote>
    </transition>

    <ErrorBoundary fallback-title="Town Square Error">
      <TownSquare></TownSquare>
    </ErrorBoundary>

    <ErrorBoundary fallback-title="Timer Error">
      <Timer></Timer>
    </ErrorBoundary>

    <ErrorBoundary fallback-title="Menu Error">
      <Menu ref="menu"></Menu>
    </ErrorBoundary>

    <ErrorBoundary fallback-title="Modal Error">
      <EditionModal />
      <EndGameModal @winner-selected="handleWinnerSelected" />
      <JournalModal />
      <TimerModal />
      <NpcModal />
      <RolesModal />
      <ReferenceModal />
      <NightOrderModal />
      <VoteHistoryModal />
      <GameStateModal />
    </ErrorBoundary>

    <Gradients />
    <span id="version" aria-label="Version">v{{ version }}</span>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { version } from "../package.json";
import ErrorBoundary from "./components/ErrorBoundary";
import TownSquare from "./components/TownSquare";
import TownInfo from "./components/TownInfo";
import Timer from "./components/Timer";
import Menu from "./components/Menu";
import RolesModal from "./components/modals/RolesModal";
import EditionModal from "./components/modals/EditionModal";
import EndGameModal from "./components/modals/EndGameModal";
import Intro from "./components/Intro";
import ReferenceModal from "./components/modals/ReferenceModal";
import Vote from "./components/Vote";
import Gradients from "./components/Gradients";
import NightOrderModal from "./components/modals/NightOrderModal";
import NpcModal from "@/components/modals/NpcModal";
import VoteHistoryModal from "@/components/modals/VoteHistoryModal";
import GameStateModal from "@/components/modals/GameStateModal";
import JournalModal from "./components/modals/JournalModal";
import TimerModal from "./components/modals/TimerModal";

export default {
  components: {
    ErrorBoundary,
    GameStateModal,
    VoteHistoryModal,
    JournalModal,
    TimerModal,
    NpcModal,
    NightOrderModal,
    Vote,
    ReferenceModal,
    Intro,
    TownInfo,
    Timer,
    TownSquare,
    Menu,
    EditionModal,
    EndGameModal,
    RolesModal,
    Gradients,
  },
  computed: {
    ...mapState(["grimoire", "session"]),
    ...mapState("players", ["players"]),
  },
  data() {
    return {
      version,
    };
  },
  methods: {
    keyup(event) {
      const { key, ctrlKey, metaKey, target } = event;
      if (ctrlKey || metaKey) return;

      // Ignore keyboard shortcuts if user is typing in an input field
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      switch (key.toLocaleLowerCase()) {
        case "g":
          if (this.session.isSpectator) return;
          this.$refs.menu.toggleRevealMode();
          break;
        case "a":
          this.$refs.menu.addPlayer();
          break;
        case "h":
          this.$refs.menu.hostSession();
          break;
        case "j":
          this.$refs.menu.joinSession();
          break;
        case "w":
          this.$store.commit("toggleModal", "journal");
          break;
        case "t":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "timer");
          break;
        case "r":
          this.$store.commit("toggleModal", "reference");
          break;
        case "n":
          this.$store.commit("toggleModal", "nightOrder");
          break;
        case "e":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "edition");
          break;
        case "c":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "roles");
          break;
        case "m":
          break;
        case "v":
          if (this.session.voteHistory.length || !this.session.isSpectator) {
            this.$store.commit("toggleModal", "voteHistory");
          }
          break;
        case "s":
          if (this.session.isSpectator) return;
          this.$refs.menu.toggleNight();
          break;
        case "escape":
          this.$store.commit("toggleModal");
          break;
        case "arrowup":
          if (this.session.nomination) {
            this.$refs.vote.vote(true);
          }
          break;
        case "arrowdown":
          if (this.session.nomination) {
            this.$refs.vote.vote(false);
          }
          break;
      }
    },
    handleWinnerSelected(team) {
      if (this.$refs.menu) {
        this.$refs.menu.confirmEndGame(team);
      }
    },
  },
};
</script>

<style lang="scss">
@font-face {
  font-family: "Papyrus";
  src: url("assets/fonts/papyrus.eot"); /* IE9*/
  src:
    url("assets/fonts/papyrus.eot?#iefix") format("embedded-opentype"),
    /* IE6-IE8 */ url("assets/fonts/papyrus.woff2") format("woff2"),
    /* chrome firefox */ url("assets/fonts/papyrus.woff") format("woff"),
    /* chrome firefox */ url("assets/fonts/papyrus.ttf") format("truetype"),
    /* chrome firefox opera Safari, Android, iOS 4.2+*/
      url("assets/fonts/papyrus.svg#PapyrusW01") format("svg"); /* iOS 4.1- */
}

@font-face {
  font-family: PiratesBay;
  src: url("assets/fonts/piratesbay.ttf");
  font-display: swap;
}

html,
body {
  font-size: 1.2em;
  line-height: 1.4;
  background: url("assets/background.webp") center center;
  background-size: cover;
  color: white;
}

/* Global focus styles for accessibility */
*:focus-visible {
  outline: 3px solid $gold;
  outline-offset: 2px;
  border-radius: 3px;
}

button:focus-visible,
a:focus-visible,
[role="button"]:focus-visible,
[role="tab"]:focus-visible {
  outline: 3px solid $gold;
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(212, 175, 55, 0.2);
}

/* Skip to main content link for screen readers */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: $gold;
  color: #000;
  padding: 8px;
  text-decoration: none;
  z-index: 10000;

  &:focus {
    top: 0;
  }
}

html,
body {
  height: 100%;
  font-family: "Crimson Text", "IM Fell English", Georgia, serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

* {
  box-sizing: border-box;
  position: relative;
  user-select: none;
}

a {
  color: $townsfolk;
  &:hover {
    color: $demon;
  }
}

h1,
h2,
h3,
h4,
h5 {
  margin: 0;
  text-align: center;
  font-family: "Playfair Display", "Cinzel", serif;
  letter-spacing: 1.5px;
  font-weight: 700;
  font-weight: normal;
}

ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
}

#app {
  height: 100%;
  width: 100%;
  position: relative;
  background-position: center center;
  background-size: cover;

  // disable all animations
  &.static *,
  &.static *:after,
  &.static *:before {
    transition: none !important;
    animation: none !important;
  }
}

#version {
  position: absolute;
  text-align: right;
  right: 10px;
  bottom: 10px;
  font-size: 60%;
  opacity: 0.5;
}

.blur-enter-active,
.blur-leave-active {
  transition: all 250ms;
  filter: blur(0);
}
.blur-enter-from,
.blur-leave-to {
  opacity: 0;
  filter: blur(20px);
}

// Buttons
.button-group {
  display: flex;
  align-items: center;
  justify-content: center;
  align-content: center;
  .button {
    margin: 5px 0;
    border-radius: 0;
    &:first-child {
      border-top-left-radius: 15px;
      border-bottom-left-radius: 15px;
    }
    &:last-child {
      border-top-right-radius: 15px;
      border-bottom-right-radius: 15px;
    }
  }
}
.button {
  padding: 0;
  border: solid 0.125em rgba(212, 175, 55, 0.3);
  border-radius: 15px;
  box-shadow:
    inset 0 1px 1px rgba(212, 175, 55, 0.2),
    0 0 15px rgba(123, 44, 191, 0.3),
    0 4px 10px rgba(0, 0, 0, 0.6);
  background:
    radial-gradient(
        at 0 -15%,
        rgba(212, 175, 55, 0.1) 70%,
        rgba(255, 255, 255, 0) 71%
      )
      0 0/ 80% 90% no-repeat content-box,
    linear-gradient(#3a2a4a, #1a0a2a) content-box,
    linear-gradient(#2a1a3d, #0d0515) border-box;
  color: #f5e6d3;
  font-weight: bold;
  text-shadow:
    0 0 8px rgba(123, 44, 191, 0.5),
    1px 1px rgba(0, 0, 0, 0.8);
  line-height: 170%;
  margin: 5px auto;
  cursor: pointer;
  transition: all 350ms ease;
  white-space: nowrap;
  &:hover {
    color: rgba(212, 175, 55, 1);
    box-shadow:
      inset 0 1px 1px rgba(212, 175, 55, 0.3),
      0 0 25px rgba(123, 44, 191, 0.5),
      0 4px 15px rgba(0, 0, 0, 0.7);
    text-shadow:
      0 0 12px rgba(212, 175, 55, 0.6),
      1px 1px rgba(0, 0, 0, 0.8);
  }
  &.disabled {
    color: #6a5a7a;
    cursor: default;
    opacity: 0.5;
  }
  &:before,
  &:after {
    content: " ";
    display: inline-block;
    width: 10px;
    height: 10px;
  }
  &.townsfolk {
    background:
      radial-gradient(
          at 0 -15%,
          rgba(212, 175, 55, 0.1) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#4a5fc1, rgba(26, 15, 40, 0.8)) content-box,
      linear-gradient(#2a1a3d, #1a2d5f) border-box;
    box-shadow:
      inset 0 1px 1px rgba(74, 95, 193, 0.4),
      0 0 15px rgba(74, 95, 193, 0.3),
      0 4px 10px rgba(0, 0, 0, 0.6);
    &:hover:not(.disabled) {
      color: rgba(212, 175, 55, 1);
      box-shadow:
        inset 0 1px 1px rgba(74, 95, 193, 0.5),
        0 0 25px rgba(74, 95, 193, 0.5),
        0 4px 15px rgba(0, 0, 0, 0.7);
    }
  }
  &.demon {
    background:
      radial-gradient(
          at 0 -15%,
          rgba(212, 175, 55, 0.1) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#8b0000, rgba(26, 15, 40, 0.8)) content-box,
      linear-gradient(#2a1a3d, #5f0000) border-box;
    box-shadow:
      inset 0 1px 1px rgba(139, 0, 0, 0.4),
      0 0 15px rgba(139, 0, 0, 0.3),
      0 4px 10px rgba(0, 0, 0, 0.6);
    &:hover:not(.disabled) {
      color: rgba(212, 175, 55, 1);
      box-shadow:
        inset 0 1px 1px rgba(139, 0, 0, 0.5),
        0 0 25px rgba(139, 0, 0, 0.5),
        0 4px 15px rgba(0, 0, 0, 0.7);
    }
  }
}

/* video background */
video#background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Night phase backdrop */
#app > .backdrop {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  pointer-events: none;
  background: black;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 1) 0%,
    rgba(1, 22, 46, 1) 50%,
    rgba(0, 39, 70, 1) 100%
  );
  opacity: 0;
  transition: opacity 1s ease-in-out;
  &:after {
    content: " ";
    display: block;
    width: 100%;
    padding-right: 2000px;
    height: 100%;
    background: url("assets/clouds.webp") repeat;
    background-size: 2000px auto;
    animation: move-background 120s linear infinite;
    opacity: 0.3;
  }
}

@keyframes move-background {
  from {
    transform: translate3d(-2000px, 0px, 0px);
  }
  to {
    transform: translate3d(0px, 0px, 0px);
  }
}

#app.night > .backdrop {
  opacity: 0.5;
}
</style>
