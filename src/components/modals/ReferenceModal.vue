<template>
  <Modal
    class="characters"
    @close="toggleModal('reference')"
    v-if="modals.reference && roles.size"
  >
    <font-awesome-icon
      @click="toggleModal('nightOrder')"
      icon="cloud-moon"
      class="toggle"
      title="Show Night Order"
    />
    <h3>
      Character Reference
      <br />
      <font-awesome-icon icon="address-card" />
      {{ edition.name || "Custom Script" }}
    </h3>

    <div
      class="team bootlegger"
      v-if="edition.bootlegger && edition.bootlegger.length"
    >
      <aside>
        <h4>Rules</h4>
      </aside>
      <ul>
        <li v-for="(rule, index) in edition.bootlegger" :key="index">
          <img
            class="icon"
            :src="iconImages['../../assets/icons/bootlegger.webp']"
            alt="bootlegger"
          />
          <div class="role">
            <span class="ability">{{ rule }}</span>
          </div>
        </li>
        <li></li>
        <li></li>
      </ul>
    </div>

    <div
      v-for="(teamRoles, team) in rolesGrouped"
      :key="team"
      :class="['team', team]"
    >
      <aside>
        <h4>{{ team }}</h4>
      </aside>
      <ul>
        <li v-for="role in teamRoles" :class="[team]" :key="role.id">
          <img
            class="icon"
            v-if="role.id"
            :src="getImage(role)"
            :alt="role.name"
          />
          <div class="role">
            <span class="player" v-if="Object.keys(playersByRole).length">{{
              playersByRole[role.id] ? playersByRole[role.id].join(", ") : ""
            }}</span>
            <span class="name">{{ role.name }}</span>
            <span class="ability">{{ role.ability }}</span>
          </div>
        </li>
        <li :class="[team]"></li>
        <li :class="[team]"></li>
      </ul>
    </div>

    <div class="team jinxed" v-if="jinxed.length">
      <aside>
        <h4>Jinxed</h4>
      </aside>
      <ul>
        <li v-for="(jinx, index) in jinxed" :key="index">
          <img
            class="icon"
            :src="getImage(jinx.first)"
            :alt="jinx.first.name"
          />
          <img
            class="icon"
            :src="getImage(jinx.second)"
            :alt="jinx.second.name"
          />
          <div class="role">
            <span class="name"
              >{{ jinx.first.name }} & {{ jinx.second.name }}</span
            >
            <span class="ability">{{ jinx.reason }}</span>
          </div>
        </li>
        <li></li>
        <li></li>
      </ul>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { getRoleIcon } from "@/utils/images";
import { mapMutations, mapState } from "vuex";

export default {
  components: {
    Modal,
  },
  computed: {
    /**
     * Return a list of jinxes in the form of role IDs and a reason
     * @returns {*[]} [{first, second, reason}]
     */
    jinxed: function () {
      const jinxed = [];
      const pushAllJinxes = (role, jinxes) => {
        jinxes.forEach((reason, second) => {
          if (this.roles.get(second)) {
            jinxed.push({
              first: role,
              second: this.roles.get(second),
              reason,
            });
          }
        });
      };
      this.roles.forEach((role) => {
        if (this.jinxes.get(role.id))
          pushAllJinxes(role, this.jinxes.get(role.id));
        if (role.jinxes) pushAllJinxes(role, role.jinxes);
      });
      return jinxed;
    },
    rolesGrouped() {
      const grouped = {
        townsfolk: [],
        outsider: [],
        minion: [],
        demon: [],
        fabled: [],
      };
      this.roles.forEach((role) => {
        if (role.team && grouped[role.team] && role.team !== "traveller") {
          grouped[role.team].push(role);
        }
      });
      // Return only teams with roles
      return Object.fromEntries(
        Object.entries(grouped).filter(([, roles]) => roles.length > 0),
      );
    },
    playersByRole: function () {
      const players = {};
      this.players.forEach(({ name, role }) => {
        if (role && role.id && role.team !== "traveller") {
          if (!players[role.id]) {
            players[role.id] = [];
          }
          players[role.id].push(name);
        }
      });
      return players;
    },
    ...mapState(["roles", "modals", "edition", "grimoire", "jinxes"]),
    ...mapState("players", ["players"]),
  },
  methods: {
    getImage(role) {
      if (role.image && this.grimoire.isImageOptIn) {
        if (Array.isArray(role.image)) {
          return role.image[0];
        }

        return role.image;
      }

      return getRoleIcon(role.id, role.imageAlt);
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style lang="scss" scoped>
.toggle {
  position: absolute;
  left: 20px;
  top: 15px;
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
  margin: 0 40px;
  svg {
    vertical-align: middle;
  }
  line-height: 90%;
}

.townsfolk {
  .name {
    color: $townsfolk;
  }
  aside {
    background: linear-gradient(-90deg, $townsfolk, transparent);
  }
}
.outsider {
  .name {
    color: $outsider;
  }
  aside {
    background: linear-gradient(-90deg, $outsider, transparent);
  }
}
.minion {
  .name {
    color: $minion;
  }
  aside {
    background: linear-gradient(-90deg, $minion, transparent);
  }
}
.demon {
  .name {
    color: $demon;
  }
  aside {
    background: linear-gradient(-90deg, $demon, transparent);
  }
}

.jinxed {
  .name {
    color: $fabled;
  }
  aside {
    background: linear-gradient(-90deg, $fabled, transparent);
  }
}

.bootlegger {
  aside {
    background: linear-gradient(-90deg, $loric, transparent);
  }
}

.team {
  display: flex;
  align-items: stretch;
  width: 100%;
  &:not(:last-child):after {
    content: " ";
    display: block;
    width: 25%;
    height: 1px;
    background: linear-gradient(90deg, rgba(212, 175, 55, 0.5), transparent);
    box-shadow: 0 0 4px rgba(212, 175, 55, 0.3);
    position: absolute;
    left: 0;
    bottom: 0;
  }
  aside {
    width: 30px;
    display: flex;
    flex-grow: 0;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    align-content: center;
    overflow: hidden;
    text-shadow: 0 0 4px black;
  }

  h4 {
    text-transform: uppercase;
    text-align: center;
    transform: rotate(90deg);
    transform-origin: center;
    font-size: 80%;
  }

  &.jinxed {
    .icon {
      margin: 0 -5px;
    }
  }
}

ul {
  flex-grow: 1;
  display: flex;
  padding: 5px 0;

  li {
    display: flex;
    align-items: center;
    flex-grow: 1;
    width: 420px;
    .icon {
      width: 8vh;
      height: 8vh;
      object-fit: contain;
      flex-shrink: 0;
      flex-grow: 0;
    }
    .role {
      line-height: 80%;
      flex-grow: 1;
    }
    .name {
      font-weight: bold;
      font-size: 75%;
      display: block;
    }
    .player {
      color: #888;
      float: right;
      font-size: 60%;
    }
    .ability {
      font-size: 70%;
    }
  }
}

/** break into 1 column below 1200px **/
@media screen and (max-width: 1199.98px) {
  .toggle {
    width: 20px;
    height: 15px;
  }
  .modal {
    max-width: 60%;
  }
  ul {
    li {
      width: 100%;
      padding: 0px 5px 5px 0px;
      .icon {
        width: 6vh;
      }
      .role {
        line-height: 100%;
      }
      .name {
        font-size: 100%;
      }
      .player {
        font-size: 100%;
      }
      .ability {
        font-size: 90%;
        text-wrap: wrap;
        line-height: 80%;
      }
    }
  }
}

// if screen is less than 800px, make it 90%
@media screen and (max-width: 800px) {
  .modal {
    max-width: 90%;
  }
  ul {
    li {
      aside h4 {
        font-size: 16px;
      }
      .icon {
        width: 9vh;
      }
      .role {
        line-height: 125%;
        font-size: 150%;
      }
    }
  }
}

/** trim icon size on maximized one-column sheet **/
@media screen and (max-width: 991.98px) {
  .characters .modal.maximized ul li .icon {
    width: 5.1vh;
  }
}

/** hide players when town square is set to "public" **/
#townsquare.public ~ .characters .modal .player {
  display: none;
}
</style>
