<template>
  <div
    id="townsquare"
    class="square"
    :class="{
      public: grimoire.isPublic,
      spectator: session.isSpectator,
      vote: session.nomination,
      'reveal-mode': grimoire.isRevealMode,
    }"
  >
    <ul class="circle" :class="['size-' + players.length]">
      <Player
        v-for="(player, index) in players"
        :key="index"
        :player="player"
        :is-nominating="nominate === players.indexOf(player)"
        @trigger="handleTrigger(index, $event)"
        :class="{
          from: Math.max(swap, move, nominate) === index,
          swap: swap > -1,
          move: move > -1,
          nominate: nominate > -1,
        }"
      ></Player>
    </ul>

    <div
      class="bluffs"
      v-if="players.length"
      ref="bluffs"
      :class="{ closed: !isBluffsOpen }"
    >
      <h3>
        <span v-if="session.isSpectator">Other Characters</span>
        <span v-else>Demon Bluffs</span>
        <font-awesome-icon
          :icon="isBluffsOpen ? 'times-circle' : 'plus-circle'"
          @click.stop="toggleBluffs"
        />
      </h3>
      <ul>
        <li
          v-for="index in bluffSize"
          :key="index"
          @click="openRoleModal(index * -1)"
        >
          <Token :role="bluffs[index - 1]"></Token>
        </li>
      </ul>
    </div>

    <div class="npcs" :class="{ closed: !isNpcsOpen }" v-if="npcs.length">
      <h3>
        <span>NPCs</span>
        <font-awesome-icon
          :icon="isNpcsOpen ? 'times-circle' : 'plus-circle'"
          @click.stop="toggleNpcs"
        />
      </h3>
      <ul>
        <li
          v-for="(role, index) in npcs"
          :key="index"
          @click="removeNpc(index)"
        >
          <div
            class="night-order first"
            v-if="
              nightOrder.get(role).first &&
              grimoire.isNightOrder &&
              !session.isSpectator
            "
          >
            <em>{{ nightOrder.get(role).first }}</em>
            <span v-if="role.firstNightReminder">{{
              role.firstNightReminder
            }}</span>
          </div>
          <div
            class="night-order other"
            v-if="
              nightOrder.get(role).other &&
              grimoire.isNightOrder &&
              !session.isSpectator
            "
          >
            <em>{{ nightOrder.get(role).other }}</em>
            <span v-if="role.otherNightReminder">{{
              role.otherNightReminder
            }}</span>
          </div>
          <Token :role="role"></Token>
        </li>
      </ul>
    </div>

    <ReminderModal :player-index="selectedPlayer"></ReminderModal>
    <RoleModal :player-index="selectedPlayer"></RoleModal>
  </div>
</template>

<script lang="ts">
import { ref, computed, defineComponent } from "vue";
import { useStore } from "vuex";
import Player from "./Player.vue";
import Token from "./Token.vue";
import ReminderModal from "./modals/ReminderModal.vue";
import RoleModal from "./modals/RoleModal.vue";
import type { Player as PlayerType, Role } from "@/types/player";

export default defineComponent({
  name: "TownSquare",
  components: {
    Player,
    Token,
    RoleModal,
    ReminderModal,
  },
  setup() {
    const store = useStore();

    // Refs
    const selectedPlayer = ref<number>(0);
    const bluffSize = ref<number>(3);
    const swap = ref<number>(-1);
    const move = ref<number>(-1);
    const nominate = ref<number>(-1);
    const isBluffsOpen = ref<boolean>(true);
    const isNpcsOpen = ref<boolean>(true);

    // Computed properties from Vuex
    const grimoire = computed(() => store.state.grimoire);
    const roles = computed(() => store.state.roles);
    const session = computed(() => store.state.session);
    const players = computed<PlayerType[]>(() => store.state.players.players);
    const bluffs = computed<Role[]>(() => store.state.players.bluffs);
    const npcs = computed<Role[]>(() => store.state.players.npcs);
    const nightOrder = computed(() => store.getters["players/nightOrder"]);
    const discordUserId = computed(() => store.state.stats.discordUserId);

    // Methods
    const toggleBluffs = () => {
      isBluffsOpen.value = !isBluffsOpen.value;
    };

    const toggleNpcs = () => {
      isNpcsOpen.value = !isNpcsOpen.value;
    };

    const removeNpc = (index: number) => {
      if (session.value.isSpectator) return;
      store.commit("players/setNpcs", { index });
    };

    const handleTrigger = (
      playerIndex: number,
      [method, params]: [string, any?],
    ) => {
      const methods: Record<string, Function> = {
        claimSeat,
        openReminderModal,
        openRoleModal,
        removePlayer,
        swapPlayer,
        movePlayer,
        nominatePlayer,
        cancel,
      };

      if (methods[method]) {
        methods[method](playerIndex, params);
      }
    };

    const claimSeat = (playerIndex: number) => {
      if (!session.value.isSpectator) return;
      const player = players.value[playerIndex];
      if (session.value.playerId === player.id && player.connected) {
        store.commit("session/claimSeat", -1);
      } else {
        store.commit("session/claimSeat", playerIndex);
        // Link Discord ID to the claimed seat (now from Vuex)
        if (discordUserId.value) {
          store.commit("players/update", {
            player: players.value[playerIndex],
            property: "discord_id",
            value: discordUserId.value,
          });
        }
      }
    };

    const openReminderModal = (playerIndex: number) => {
      selectedPlayer.value = playerIndex;
      store.commit("toggleModal", "reminder");
    };

    const openRoleModal = (playerIndex: number) => {
      const player = players.value[playerIndex];
      if (
        session.value.isSpectator &&
        player &&
        player.role.team === "traveller"
      )
        return;
      selectedPlayer.value = playerIndex;
      store.commit("toggleModal", "role");
    };

    const removePlayer = (playerIndex: number) => {
      if (session.value.isSpectator || session.value.lockedVote) return;
      if (
        confirm(
          `Do you really want to remove ${players.value[playerIndex].name}?`,
        )
      ) {
        const { nomination } = session.value;
        if (nomination) {
          if (nomination.includes(playerIndex)) {
            // abort vote if removed player is either nominator or nominee
            store.commit("session/nomination");
          } else if (
            nomination[0] > playerIndex ||
            nomination[1] > playerIndex
          ) {
            // update nomination array if removed player has lower index
            store.commit("session/setNomination", [
              nomination[0] > playerIndex ? nomination[0] - 1 : nomination[0],
              nomination[1] > playerIndex ? nomination[1] - 1 : nomination[1],
            ]);
          }
        }
        store.commit("players/remove", playerIndex);
      }
    };

    const swapPlayer = (from: number, to?: PlayerType) => {
      if (session.value.isSpectator || session.value.lockedVote) return;
      if (to === undefined) {
        cancel();
        swap.value = from;
      } else {
        if (session.value.nomination) {
          // update nomination if one of the involved players is swapped
          const swapTo = players.value.indexOf(to);
          const updatedNomination = session.value.nomination.map(
            (nom: number) => {
              if (nom === swap.value) return swapTo;
              if (nom === swapTo) return swap.value;
              return nom;
            },
          ) as [number, number];
          if (
            session.value.nomination[0] !== updatedNomination[0] ||
            session.value.nomination[1] !== updatedNomination[1]
          ) {
            store.commit("session/setNomination", updatedNomination);
          }
        }
        store.commit("players/swap", [swap.value, players.value.indexOf(to)]);
        cancel();
      }
    };

    const movePlayer = (from: number, to?: PlayerType) => {
      if (session.value.isSpectator || session.value.lockedVote) return;
      if (to === undefined) {
        cancel();
        move.value = from;
      } else {
        if (session.value.nomination) {
          // update nomination if it is affected by the move
          const moveTo = players.value.indexOf(to);
          const updatedNomination = session.value.nomination.map(
            (nom: number) => {
              if (nom === move.value) return moveTo;
              if (nom > move.value && nom <= moveTo) return nom - 1;
              if (nom < move.value && nom >= moveTo) return nom + 1;
              return nom;
            },
          ) as [number, number];
          if (
            session.value.nomination[0] !== updatedNomination[0] ||
            session.value.nomination[1] !== updatedNomination[1]
          ) {
            store.commit("session/setNomination", updatedNomination);
          }
        }
        store.commit("players/move", [move.value, players.value.indexOf(to)]);
        cancel();
      }
    };

    const nominatePlayer = (from: number, to?: PlayerType) => {
      if (session.value.isSpectator || session.value.lockedVote) return;
      if (to === undefined) {
        const previousNominate = nominate.value;
        cancel();
        if (from !== previousNominate) {
          nominate.value = from;
        }
      } else {
        const nomination: [number, number] = [
          nominate.value,
          players.value.indexOf(to),
        ];
        store.commit("session/nomination", { nomination });
        cancel();
      }
    };

    const cancel = () => {
      move.value = -1;
      swap.value = -1;
      nominate.value = -1;
    };

    return {
      // Refs
      selectedPlayer,
      bluffSize,
      swap,
      move,
      nominate,
      isBluffsOpen,
      isNpcsOpen,

      // Computed
      grimoire,
      roles,
      session,
      players,
      bluffs,
      npcs,
      nightOrder,

      // Methods
      toggleBluffs,
      toggleNpcs,
      removeNpc,
      handleTrigger,
      claimSeat,
      openReminderModal,
      openRoleModal,
      removePlayer,
      swapPlayer,
      movePlayer,
      nominatePlayer,
      cancel,
    };
  },
});
</script>

<style lang="scss">
#townsquare {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  padding: 20px;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  z-index: 10;
}

.circle {
  padding: 0;
  width: 100%;
  height: 100%;
  list-style: none;
  margin: 0;

  @media (orientation: portrait) {
    height: 100vw;
  }

  > li {
    position: absolute;
    left: 50%;
    height: 50%;
    transform-origin: 0 100%;
    pointer-events: none;

    &:hover {
      z-index: 25 !important;
    }

    > .player {
      margin-left: -50%;
      width: 100%;
      pointer-events: all;
    }
    > .reminder {
      margin-left: calc(-25% - 2.5px);
      width: 50%;
      pointer-events: all;
    }
  }
}

@mixin on-circle($item-count) {
  $angle: math.div(360, $item-count);
  $rot: 0;

  // rotation and tooltip placement
  @for $i from 1 through $item-count {
    &:nth-child(#{$i}) {
      transform: rotate($rot * 1deg);
      @if $i - 1 <= math.div($item-count, 2) {
        // first half of players
        z-index: $item-count - $i + 1;
        // open menu on the left
        .player > .menu {
          left: auto;
          right: 110%;
          margin-right: 15px;
          &:before {
            border-left-color: black;
            border-right-color: transparent;
            right: auto;
            left: 100%;
          }
        }
        .fold-enter-active,
        .fold-leave-active {
          transform-origin: right center;
        }
        .fold-enter-from,
        .fold-leave-to {
          transform: perspective(200px) rotateY(-90deg);
        }
        // show ability tooltip on the left
        .ability {
          right: 120%;
          left: auto;
          &:before {
            border-right-color: transparent;
            border-left-color: black;
            right: auto;
            left: 100%;
          }
        }
      } @else {
        // second half of players
        z-index: $i - 1;
      }

      > * {
        transform: rotate($rot * -1deg);
      }

      // animation cascade
      .life,
      .token,
      .shroud,
      .night-order,
      .seat {
        animation-delay: ($i - 1) * 50ms;
        transition-delay: ($i - 1) * 50ms;
      }

      // move reminders closer to the sides of the circle
      $q: math.div($item-count, 4);
      $x: $i - 1;
      @if $x < $q or ($x >= math.div($item-count, 2) and $x < $q * 3) {
        .player {
          margin-bottom: -10% + 20% * (1 - math.div($x % $q, $q));
        }
      } @else {
        .player {
          margin-bottom: -10% + 20% * math.div($x % $q, $q);
        }
      }
    }
    $rot: $rot + $angle;
  }
}

@for $i from 1 through 20 {
  .circle.size-#{$i} > li {
    @include on-circle($item-count: $i);
  }
}

/***** Demon bluffs / NPCs *******/
#townsquare > .bluffs,
#townsquare > .npcs {
  position: absolute;
  &.bluffs {
    bottom: 10px;
  }
  &.npcs {
    top: 10px;
  }
  left: 10px;
  background: linear-gradient(
    135deg,
    rgba(42, 26, 61, 0.9) 0%,
    rgba(26, 15, 40, 0.95) 100%
  );
  backdrop-filter: blur(4px);
  border-radius: 10px;
  border: 2px solid rgba(212, 175, 55, 0.3);
  box-shadow:
    0 0 30px rgba(123, 44, 191, 0.3),
    0 8px 20px rgba(0, 0, 0, 0.7),
    inset 0 0 40px rgba(139, 0, 0, 0.1);
  transform-origin: bottom left;
  transform: scale(1);
  opacity: 1;
  transition: all 350ms ease;
  z-index: 50;

  > svg {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    color: rgba(212, 175, 55, 0.7);
    filter: drop-shadow(0 0 5px rgba(212, 175, 55, 0.3));
    transition: all 250ms ease;
    &:hover {
      color: rgba(212, 175, 55, 1);
      filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.5));
      transform: scale(1.1);
    }
  }
  h3 {
    margin: 5px 1vh 0;
    display: flex;
    align-items: center;
    align-content: center;
    justify-content: center;
    span {
      flex-grow: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    svg {
      cursor: pointer;
      flex-grow: 0;
      &.fa-times-circle {
        margin-left: 1vh;
      }
      &.fa-plus-circle {
        margin-left: 1vh;
        display: none;
      }
      &:hover path {
        fill: url(#demon);
        stroke-width: 30px;
        stroke: white;
      }
    }
  }
  ul {
    display: flex;
    align-items: center;
    justify-content: center;
    li {
      width: 14vh;
      height: 14vh;
      margin: 0 0.5%;
      display: inline-block;
      position: relative;
      transition: all 250ms;

      &:hover {
        z-index: 100;
      }
    }

    @media (orientation: portrait) {
      li {
        width: 16vw;
        height: 16vw;
      }
    }
  }
  &.closed {
    svg.fa-times-circle {
      display: none;
    }
    svg.fa-plus-circle {
      display: block;
    }
    ul li {
      width: 0;
      height: 0;
      .night-order {
        opacity: 0;
      }
      .token {
        border-width: 0;
      }
    }
  }
}

#townsquare.public > .bluffs {
  opacity: 0;
  transform: scale(0.1);
}

#townsquare.reveal-mode > .bluffs,
#townsquare.reveal-mode > .npcs {
  opacity: 0;
  transform: scale(0.1);
  pointer-events: none;
}

.npcs ul li .token:before {
  content: " ";
  opacity: 0;
  transition: opacity 250ms;
  background-image: url("../assets/x.webp");
  z-index: 2;
}

/**** Night reminders ****/
.night-order {
  position: absolute;
  width: 100%;
  cursor: pointer;
  opacity: 1;
  transition: opacity 200ms;
  display: flex;
  top: 0;
  align-items: center;
  pointer-events: none;

  &:after {
    content: " ";
    display: block;
    padding-top: 100%;
  }

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }

  &:hover ~ .token .ability {
    opacity: 0;
  }

  span {
    display: flex;
    position: absolute;
    padding: 5px 10px 5px 30px;
    width: 350px;
    z-index: 1;
    font-size: 70%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    text-align: left;
    align-items: center;
    opacity: 0;
    transition: opacity 200ms ease-in-out;

    &:before {
      transform: rotate(-90deg);
      transform-origin: center top;
      left: -98px;
      top: 50%;
      font-size: 100%;
      position: absolute;
      font-weight: bold;
      text-align: center;
      width: 200px;
    }

    &:after {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      position: absolute;
    }
  }

  &.first span {
    right: 120%;
    background: linear-gradient(
      to right,
      $townsfolk 0%,
      rgba(0, 0, 0, 0.5) 20%
    );
    &:before {
      content: "First Night";
    }
    &:after {
      border-left-color: $townsfolk;
      margin-left: 3px;
      left: 100%;
    }
  }

  &.other span {
    left: 120%;
    background: linear-gradient(to right, $demon 0%, rgba(0, 0, 0, 0.5) 20%);
    &:before {
      content: "Other Nights";
    }
    &:after {
      right: 100%;
      margin-right: 3px;
      border-right-color: $demon;
    }
  }

  em {
    font-style: normal;
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid black;
    filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.5));
    font-weight: bold;
    opacity: 1;
    pointer-events: all;
    transition: opacity 200ms;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3;
  }

  &.first em {
    left: -10%;
    background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, $townsfolk 100%);
  }

  &.other em {
    right: -10%;
    background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, $demon 100%);
  }

  em:hover + span {
    opacity: 1;
  }

  // adjustment for npcs
  .npcs &.first {
    span {
      right: auto;
      left: 40px;
      &:after {
        left: auto;
        right: 100%;
        margin-left: 0;
        margin-right: 3px;
        border-left-color: transparent;
        border-right-color: $townsfolk;
      }
    }
  }
}

#townsquare:not(.spectator) .npcs ul li:hover .token:before {
  opacity: 1;
}
</style>
