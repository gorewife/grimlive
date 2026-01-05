<template>
  <Modal class="editions" v-if="modals.edition" @close="toggleModal('edition')">
    <div v-if="!isCustom">
      <h3>Select an edition:</h3>
      <ul class="editions">
        <li
          v-for="edition in editions"
          class="edition"
          :class="['edition-' + edition.id]"
          :style="{
            backgroundImage: `url(${getEditionImage(edition.id)})`,
          }"
          :key="edition.id"
          @click="loadOfficial(edition)"
        >
          {{ edition.name }}
        </li>
        <li
          class="edition edition-custom"
          @click="isCustom = true"
          :style="{
            backgroundImage: `url(${getEditionImage('custom')})`,
          }"
        >
          Custom Script / Characters
        </li>
      </ul>
    </div>
    <div class="custom" v-else>
      <h3>Load custom script / characters</h3>
      To write your own custom script, you need to select the characters you
      want to play with in the official
      <a href="https://script.bloodontheclocktower.com/" target="_blank"
        >Script Tool</a
      >
      and then upload the generated JSON either directly here or provide a URL
      to such a hosted JSON file. There are also a multitude of existing popular
      custom scripts, many of which can be found at
      <a href="https://botcscripts.com/?sort=num_favs" target="_blank"
        >botcscripts.com</a
      >.<br />
      <br />
      To play with custom characters, please read
      <a
        href="https://github.com/gorewife/grimlive#custom-character-support"
        target="_blank"
        >the documentation</a
      >
      on how to write a custom character definition file.
      <b>Only load custom JSON files from sources that you trust!</b>
      <h3>Some popular custom scripts:</h3>
      <ul class="scripts">
        <li
          v-for="(script, index) in customs.teensyville"
          :key="index"
          @click="parseRoles(script)"
        >
          {{ script[0].name + " by " + script[0].author + " (Teensyville)" }}
        </li>
        <li
          v-for="(script, index) in customs.standard"
          :key="index + customs.teensyville.length"
          @click="parseRoles(script)"
        >
          {{ script[0].name + " by " + script[0].author }}
        </li>
      </ul>
      <input
        type="file"
        ref="upload"
        accept="application/json"
        @change="handleUpload"
      />
      <div class="button-group">
        <div class="button" @click="openUpload">
          <font-awesome-icon icon="file-upload" /> Upload JSON
        </div>
        <div class="button" @click="promptURL">
          <font-awesome-icon icon="link" /> Enter URL
        </div>
        <div class="button" @click="readFromClipboard">
          <font-awesome-icon icon="clipboard" /> Use JSON from Clipboard
        </div>
        <div class="button" @click="isCustom = false">
          <font-awesome-icon icon="undo" /> Back
        </div>
      </div>
    </div>
  </Modal>
</template>

<script>
import customsJSON from "../../customs";
import editionJSON from "../../editions";
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import { getEditionImage } from "@/utils/images";

export default {
  components: {
    Modal,
  },
  data: function () {
    return {
      customs: customsJSON,
      editions: editionJSON,
      isCustom: false,
    };
  },
  computed: mapState(["roles", "modals", "edition", "jinxes"]),
  methods: {
    getEditionImage,
    openUpload() {
      this.$refs.upload.click();
    },
    handleUpload() {
      const file = this.$refs.upload.files[0];
      if (file && file.size) {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          try {
            const roles = JSON.parse(reader.result);
            this.parseRoles(roles);
          } catch (e) {
            alert("Error reading custom script: " + e.message);
          }
          this.$refs.upload.value = "";
        });
        reader.readAsText(file);
      }
    },
    promptURL() {
      const url = prompt("Enter URL to a custom-script.json file");
      if (url) {
        this.handleURL(url);
      }
    },
    async handleURL(url) {
      const res = await fetch(url);
      if (res && res.json) {
        try {
          const script = await res.json();
          this.parseRoles(script);
        } catch (e) {
          console.log(e);
          alert("Error loading custom script: " + e.message);
        }
      }
    },
    async readFromClipboard() {
      const text = await navigator.clipboard.readText();
      try {
        const roles = JSON.parse(text);
        this.parseRoles(roles);
      } catch (e) {
        console.log(e);
        alert("Error reading custom script: " + e.message);
      }
    },
    loadOfficial(edition) {
      this.$store.commit("players/setNpcs", {});
      this.$store.commit("setEdition", edition);
    },
    parseRoles(roles) {
      if (!roles || !roles.length) return;
      roles = roles.map((role) =>
        typeof role === "string" ? { id: role } : role,
      );
      const metaIndex = roles.findIndex(({ id }) => id === "_meta");
      let meta = {};
      if (metaIndex > -1) {
        meta = roles.splice(metaIndex, 1).pop();
      }
      if (meta.firstNight) {
        meta.firstNight = meta.firstNight.map((id) =>
          this.$store.getters.clean(id),
        );
      }
      if (meta.otherNight) {
        meta.otherNight = meta.otherNight.map((id) =>
          this.$store.getters.clean(id),
        );
      }
      this.$store.commit("setCustomRoles", roles);
      this.$store.commit(
        "setEdition",
        Object.assign({}, meta, { id: "custom" }),
      );
      // check for fabled & loric and set those too, if present
      const npcs = [];
      roles.forEach((role) => {
        if (this.$store.state.npcs.has(role.id || role)) {
          npcs.push(this.$store.state.npcs.get(role.id || role));
        }
      });
      if (
        this.roles &&
        typeof this.roles.values === "function" &&
        Array.from(this.roles.values()).some((role) =>
          new Map([...(this.jinxes.get(role.id) || []), ...(role.jinxes || [])])
            .keys()
            .some((second) => this.roles.get(second)),
        ) &&
        !npcs.some((npc) => npc.id === "djinn")
      ) {
        npcs.push(this.$store.state.npcs.get("djinn"));
      }
      if (
        ((this.roles &&
          typeof this.roles.values === "function" &&
          Array.from(this.roles.values()).some((role) => role.isCustom)) ||
          this.edition.bootlegger) &&
        !npcs.some((npc) => npc.id === "bootlegger")
      ) {
        npcs.push(this.$store.state.npcs.get("bootlegger"));
      }
      this.$store.commit("players/setNpcs", {});
      this.$store.commit("players/setNpcs", { npcs });
      this.isCustom = false;
      this.toggleModal("edition");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
ul.editions .edition {
  font-family: "Playfair Display", "Cinzel", serif;
  letter-spacing: 1.5px;
  font-weight: 700;
  font-style: italic;
  text-align: center;
  padding-top: 20%;
  background-position: center center;
  background-size: 50%;
  background-repeat: no-repeat;
  width: 45%;
  margin: 5px;
  font-size: 120%;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 0 5px rgba(0, 0, 0, 0.75);
  cursor: pointer;
  transition: all 250ms ease;
  &:hover {
    color: rgba(212, 175, 55, 1);
    text-shadow:
      1px 1px 0 #000,
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 15px rgba(212, 175, 55, 0.6);
    transform: scale(1.02);
  }
}

.custom {
  text-align: center;
  input[type="file"] {
    display: none;
  }
  .scripts {
    list-style-type: disc;
    font-size: 120%;
    cursor: pointer;
    display: block;
    width: 50%;
    text-align: left;
    margin: 10px auto;
    li:hover {
      color: rgba(212, 175, 55, 1);
      text-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
    }
  }
}
</style>
