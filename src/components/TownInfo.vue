<template>
  <ul class="info">
    <li
      class="edition"
      :class="['edition-' + edition.id]"
      :style="{
        backgroundImage: `url(${
          edition.logo && grimoire.isImageOptIn
            ? edition.logo
            : getEditionImage(edition.id)
        })`,
      }"
    ></li>
    <li v-if="players.length - teams.traveller < 5">
      Please add more players!
    </li>
    <li>
      <span class="meta" v-if="!(edition.isOfficial || edition.hideTitle)">
        {{ edition.name }}
        {{ edition.author ? "by " + edition.author : "" }}
      </span>
      <span>
        {{ players.length }} <font-awesome-icon class="players" icon="users" />
      </span>
      <span>
        {{ teams.alive }}
        <font-awesome-icon class="alive" icon="heartbeat" />
      </span>
      <span>
        {{ teams.votes }} <font-awesome-icon class="votes" icon="vote-yea" />
      </span>
    </li>
    <li v-if="players.length - teams.traveller >= 5">
      <span>
        {{ teams.townsfolk }}
        <font-awesome-icon class="townsfolk" icon="user-friends" />
      </span>
      <span>
        {{ teams.outsider }}
        <font-awesome-icon
          class="outsider"
          :icon="teams.outsider > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span>
        {{ teams.minion }}
        <font-awesome-icon
          class="minion"
          :icon="teams.minion > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span>
        {{ teams.demon }}
        <font-awesome-icon
          class="demon"
          :icon="teams.demon > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span v-if="teams.traveller">
        {{ teams.traveller }}
        <font-awesome-icon
          class="traveller"
          :icon="teams.traveller > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span v-if="grimoire.isNight">
        Night phase
        <font-awesome-icon :icon="['fas', 'cloud-moon']" />
      </span>
    </li>
  </ul>
</template>

<script>
import gameJSON from "./../counts.json";
import { mapState } from "vuex";
import { getEditionImage } from "@/utils/images";

export default {
  methods: {
    getEditionImage,
  },
  computed: {
    teams: function () {
      const { players } = this.$store.state.players;
      const nonTravellers = this.$store.getters["players/nonTravellers"];
      const alive = players.filter((player) => player.isDead !== true).length;
      return {
        ...gameJSON[nonTravellers - 5],
        traveller: players.length - nonTravellers,
        alive,
        votes:
          alive +
          players.filter(
            (player) => player.isDead === true && player.isVoteless !== true,
          ).length,
      };
    },
    ...mapState(["edition", "grimoire"]),
    ...mapState("players", ["players"]),
  },
};
</script>

<style lang="scss" scoped>
.info {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  width: 25%;
  height: 25%;
  min-width: 300px;
  min-height: 300px;
  padding: 0;
  align-items: center;
  justify-content: center;
  background: url("../assets/demon-head.webp") center center no-repeat;
  background-size: contain;
  z-index: 1;
  pointer-events: none;

  @media (orientation: portrait) {
    width: 40%;
    height: 40%;
    background-size: contain;
  }
  li {
    font-weight: bold;
    font-size: 1.1em;
    width: 100%;
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: 15px;
    text-shadow:
      0 2px 1px black,
      0 -2px 1px black,
      2px 0 1px black,
      -2px 0 1px black;

    span {
      white-space: nowrap;
    }

    .meta {
      text-align: center;
      flex-basis: 100%;
      font-family: "Playfair Display", "Cinzel", serif;
      font-weight: 700;
      font-style: italic;
      letter-spacing: 1px;
      position: absolute;
      top: -100%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      z-index: 10;
    }

    svg {
      margin-right: 10px;
    }

    .players {
      color: #00f700;
    }
    .alive {
      color: #ff4a50;
    }
    .votes {
      color: #fff;
    }
    .townsfolk {
      color: #4a5fc1;
    }
    .outsider {
      color: #5a8fa8;
    }
    .minion {
      color: #c85a28;
    }
    .demon {
      color: #8b0000;
    }
    .traveller {
      color: #7b2cbf;
    }
  }

  li.edition {
    width: 100%;
    height: 80%;
    max-width: 400px;
    max-height: 400px;
    background-position: center center;
    background-repeat: no-repeat;
    background-size: contain;
    position: relative;
    flex-shrink: 0;
    margin: 0;
    padding: 0;
  }
}
</style>
